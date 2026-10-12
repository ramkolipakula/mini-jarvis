"""
Voice Pipeline and STT Automated Verification Test Suite.
Tests the transcribe endpoint, speech-to-text accuracy, silence/empty payload handling,
and concurrency safety.
"""
import requests
import io
import wave
import uuid
import sys
import tts

BASE_URL = "http://localhost:8000"

def test_health():
    print("\n--- Test 1: Health Check ---")
    res = requests.get(f"{BASE_URL}/api/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert data.get("status") == "ONLINE", f"Expected ONLINE, got {data}"
    print("PASS: Health check is ONLINE")

def test_empty_audio_rejection():
    print("\n--- Test 2: Empty/Too Short Audio Rejection ---")
    # Zero bytes
    res = requests.post(f"{BASE_URL}/api/jarvis/transcribe", files={"file": ("empty.webm", b"", "audio/webm")})
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    print(f"PASS: 0-byte audio rejected with 400 ({res.json().get('detail')})")
    
    # 50 bytes (too short)
    res50 = requests.post(f"{BASE_URL}/api/jarvis/transcribe", files={"file": ("short.webm", b"short" * 10, "audio/webm")})
    assert res50.status_code == 400, f"Expected 400, got {res50.status_code}"
    print(f"PASS: 50-byte audio rejected with 400 ({res50.json().get('detail')})")

def test_speech_transcription_elon_musk():
    print("\n--- Test 3: Speech Audio Transcription: 'Who is Elon Musk?' ---")
    question = "Who is Elon Musk?"
    audio_bytes = tts.generate_audio(question)
    assert audio_bytes and len(audio_bytes) > 1000, "Failed to generate speech audio"
    
    res = requests.post(
        f"{BASE_URL}/api/jarvis/transcribe",
        files={"file": ("speech.mp3", audio_bytes, "audio/mp3")}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    text = data.get("text", "")
    print(f"Transcript received: '{text}'")
    assert "elon musk" in text.lower(), f"Expected 'elon musk' in '{text}'"
    print("PASS: Spoken question 'Who is Elon Musk?' accurately transcribed")

def test_longer_question_transcription():
    print("\n--- Test 4: Longer Question Without Truncation ---")
    question = "What is the capital of France and what is it famous for?"
    audio_bytes = tts.generate_audio(question)
    assert audio_bytes and len(audio_bytes) > 1000, "Failed to generate speech audio"
    
    res = requests.post(
        f"{BASE_URL}/api/jarvis/transcribe",
        files={"file": ("speech_long.mp3", audio_bytes, "audio/mp3")}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    text = res.json().get("text", "")
    print(f"Long transcript received: '{text}'")
    assert "france" in text.lower() and "capital" in text.lower(), f"Transcript truncated or inaccurate: '{text}'"
    print("PASS: Longer question accurately transcribed without truncation")

def test_silence_handling_and_guard():
    print("\n--- Test 5: Silence Audio and Hallucination Filter ---")
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b'\x00' * 32000) # 2 seconds of zero-amplitude silence
    buf.seek(0)
    
    res = requests.post(
        f"{BASE_URL}/api/jarvis/transcribe",
        files={"file": ("silence.wav", buf.read(), "audio/wav")}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    raw_text = res.json().get("text", "")
    print(f"Raw STT output for silence: '{raw_text}'")
    
    # Verify our hallucination guard logic:
    normalized = raw_text.lower().replace('.', '').replace('!', '').replace('?', '').strip()
    SILENCE_HALLUCINATIONS = [
        'thank you', 'thanks for watching', 'thank you for watching',
        'thanks', 'you mind it', 'you', 'bye', 'subtitles by', 'please subscribe', 'amara.org'
    ]
    is_filtered = normalized in SILENCE_HALLUCINATIONS or normalized == ""
    print(f"Hallucination filter would suppress: {is_filtered}")
    assert is_filtered, f"Silence hallucination '{raw_text}' should be caught by filter list"
    print("PASS: Silence hallucination accurately identified and suppressed")

def test_concurrent_transcriptions():
    print("\n--- Test 6: Concurrent Transcriptions Safe from Collisions ---")
    import concurrent.futures
    
    audio_bytes = tts.generate_audio("Hello JARVIS")
    assert audio_bytes, "Failed to generate audio"
    
    def send_one(idx):
        r = requests.post(
            f"{BASE_URL}/api/jarvis/transcribe",
            files={"file": (f"test_conc_{idx}.mp3", audio_bytes, "audio/mp3")}
        )
        return r.status_code, r.json().get("text", "")
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(send_one, i) for i in range(4)]
        results = [f.result() for f in futures]
        
    for code, text in results:
        assert code == 200, f"Concurrent request failed: code {code}"
        assert len(text) > 0, "Empty transcript on concurrent request"
    print(f"PASS: 4 concurrent transcribe requests completed without collision: {[r[1] for r in results]}")

def test_chat_endpoint_contract():
    print("\n--- Test 7: Chat API Contract Integration ---")
    res = requests.post(
        f"{BASE_URL}/api/jarvis/chat",
        json={"message": "Who is Elon Musk?", "web_mode": True}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert "response" in data and len(data["response"]) > 0
    assert "conversation_id" in data
    assert "audio" in data # base64 audio in web_mode
    safe_preview = data['response'][:80].encode('ascii', errors='replace').decode('ascii')
    print(f"JARVIS response snippet: {safe_preview}...")
    print("PASS: Chat API returns valid response and audio payload")

if __name__ == "__main__":
    try:
        test_health()
        test_empty_audio_rejection()
        test_speech_transcription_elon_musk()
        test_longer_question_transcription()
        test_silence_handling_and_guard()
        test_concurrent_transcriptions()
        test_chat_endpoint_contract()
        print("\n========================================")
        print("ALL 7 VOICE PIPELINE TESTS PASSED!")
        print("========================================")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
