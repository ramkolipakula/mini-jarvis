from groq import Groq
from config import GROQ_API_KEY, JARVIS_SYSTEM_PROMPT
import memory

# Fallback memory if DB is unavailable
fallback_messages = [
    {"role": "system", "content": JARVIS_SYSTEM_PROMPT}
]

def generate_response(user_text, conversation_id=None):
    """
    Sends the user's text to the Groq LLM and retrieves JARVIS's response.
    Integrates with Supabase for context retrieval and persistence.
    """
    if not GROQ_API_KEY:
        return "Sir, my systems are currently offline. The Groq API key is missing."
        
    client = Groq(api_key=GROQ_API_KEY)
    
    print("\r[THINKING]                ", end="")
    
    # Construct context
    messages = [{"role": "system", "content": JARVIS_SYSTEM_PROMPT}]
    
    if conversation_id:
        # Save user message to DB
        memory.add_message(conversation_id, "user", user_text)
        
        # Retrieve older relevant context across all conversations
        older_context = memory.search_previous_conversations(user_text, current_conversation_id=conversation_id, limit=3)
        if older_context:
            context_str = "Recall from previous conversations:\n"
            for msg in older_context:
                context_str += f"- {msg.get('role')}: {msg.get('content')}\n"
            messages.append({"role": "system", "content": context_str})
        
        # Retrieve recent conversation context
        recent = memory.get_recent_messages(conversation_id, limit=10)
        for msg in recent:
            messages.append({"role": msg["role"], "content": msg["content"]})
    else:
        # Fallback in-memory context
        fallback_messages.append({"role": "user", "content": user_text})
        messages = list(fallback_messages)
    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=messages,
            max_tokens=200,
            temperature=0.6
        )
        
        jarvis_text = response.choices[0].message.content.strip()
        
        if conversation_id:
            # Save assistant response to DB
            memory.add_message(conversation_id, "assistant", jarvis_text)
        else:
            # Fallback memory cleanup
            fallback_messages.append({"role": "assistant", "content": jarvis_text})
            if len(fallback_messages) > 11:
                fallback_messages.pop(1)
                fallback_messages.pop(1)
            
        return jarvis_text
    except Exception as e:
        print(f"\n[Brain Error: {e}]")
        return "I apologize sir, but I am experiencing cognitive difficulties at the moment."
