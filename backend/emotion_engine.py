def detect_emotion(text: str):
    #Detects emotion and returns (emotion, avatar) based on assignment requirements.
    text = text.lower()
    
    # Define rules matching assignment examples
    emotions = {
        "smiling": ["thank you", "thanks", "great", "awesome", "helpful", "happy", "love", "good", "perfect"],
        "surprise": ["wow", "really", "unbelievable", "amazing", "suddenly", "oh", "surprised"],
        "annoyance": ["slow", "bad", "useless", "stupid", "worst", "annoyed", "annoying", "hate", "dissatisfied", "error"],
        "panic": ["lost", "stolen", "emergency", "urgent", "help me", "immediately"],
        "curious": ["how", "what", "where", "why", "when", "can you", "explain"],
    }
    
    for emotion, keywords in emotions.items():
        if any(kw in text for kw in keywords):
            # Mapping emotion to visual states
            avatar_map = {
                "smiling": "happy",
                "surprise": "surprised",
                "annoyance": "annoyed",
                "panic": "worried",
                "curious": "thinking"
            }
            return emotion, avatar_map.get(emotion, "neutral")
            
    return "neutral", "neutral"
