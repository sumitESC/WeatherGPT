import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.config import config
import backend.app.services.agent_service as agent

def main():
    print("==================================================")
    print(" 🌤️  Welcome to WeatherGPT CLI Agent!")
    print(" Type 'exit' or 'quit' to end the conversation.")
    print("==================================================\n")
    
    if not config.GROQ_API_KEY:
        print("[!] Error: VITE_GROQ_API_KEY is missing from environment.")
        return

    chat_history = []
    
    while True:
        try:
            user_input = input("\n👤 You: ")
        except (KeyboardInterrupt, EOFError):
            break
            
        if user_input.lower() in ['exit', 'quit']:
            print("Goodbye!")
            break
            
        if not user_input.strip():
            continue

        response_text = agent.generate_response(user_input, chat_history)
        
        if response_text:
            print(f"\n🤖 WeatherGPT: {response_text}")
            chat_history.append({"role": "user", "content": user_input})
            chat_history.append({"role": "assistant", "content": response_text})
        else:
            print("\n[!] Failed to get a response from WeatherGPT.")

if __name__ == "__main__":
    main()
