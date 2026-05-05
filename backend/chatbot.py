import joblib
import os
import re
import math


class ChatbotEngine:

    def __init__(self):
        # Load the trained model and vectorizer
        model_dir = os.path.join(os.path.dirname(__file__), "ml_model")
        model_path = os.path.join(model_dir, "intent_model.joblib")
        vectorizer_path = os.path.join(model_dir, "tfidf_vectorizer.joblib")

        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            self.model = joblib.load(model_path)
            self.vectorizer = joblib.load(vectorizer_path)
            self.model_loaded = True
            print("ML model loaded successfully!")
            
            import pandas as pd
            from database import engine
            try:
                query = "SELECT question FROM training_data WHERE approved = true"
                self.df_train = pd.read_sql(query, engine)
                self.train_vectors = self.vectorizer.transform(self.df_train['question'].apply(self.preprocess_text))
            except Exception as e:
                print(f"Warning: Could not load training data from database for similarity checking: {e}")
                self.train_vectors = None
        else:
            self.model = None
            self.vectorizer = None
            self.model_loaded = False
            self.train_vectors = None
            print("WARNING: ML model not found. Run train_model.py first.")

    def preprocess_text(self, text):
        # Clean user input text
        text = str(text).lower().strip()
        text = re.sub(r'[^a-z0-9\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text

    def is_confidential(self, text):
        # Check if the user is asking for private banking data
        confidential_keywords = [
            "my account", "my balance", "my transaction", "my password",
            "my pin", "my account number", "transfer money", "my card number",
            "my loan details", "my personal", "log into my", "access my account",
            "my credit card number", "my bank details", "my statement"
        ]
        text_lower = text.lower()
        for keyword in confidential_keywords:
            if keyword in text_lower:
                return True
        return False

    def is_risky(self, text):
        # Check if message contains risky keywords
        risky_keywords = [
            "student", "child", "minor", "youth", "senior", "women",
            "business", "foreign", "premium", "gold", "corporate",
            "islamic", "education"
        ]
        text_lower = text.lower()
        for kw in risky_keywords:
            if re.search(rf'\b{kw}\b', text_lower):
                return True
        return False

    def predict_intent(self, text):
        # Predict the intent of a user message
        if not self.model_loaded:
            return "unknown", 0.0, 0.0

        # Check for confidential requests first
        if self.is_confidential(text):
            return "confidential_blocked", 1.0, 1.0

        text_lower = text.lower()
        
        # Check for emergency / lost card keywords
        emergency_keywords = ["lost", "stolen", "missing", "block", "fraud", "unauthorized"]
        card_keywords = ["card", "atm", "debit", "credit", "visa", "mastercard"]
        if any(re.search(rf'\b{kw}\b', text_lower) for kw in emergency_keywords) and \
           any(re.search(rf'\b{kw}\b', text_lower) for kw in card_keywords):
            return "lost_card_support", 0.95, 1.0
            
        # Check for greeting keywords for short texts
        greeting_keywords = ["hello", "hi", "hey", "ayubowan", "kohomada", "greetings", "good morning", "good evening", "good afternoon"]
        if len(text_lower.split()) <= 4 and any(re.search(rf'\b{kw}\b', text_lower) for kw in greeting_keywords):
            return "greeting", 0.95, 1.0

        # Check for budget keywords
        budget_keywords = ["budget", "salary", "expenses", "income"]
        if any(re.search(rf'\b{kw}\b', text_lower) for kw in budget_keywords):
            return "budget_advice", 0.95, 1.0


        # Check for loan calculation keywords
        loan_calc_keywords = ["calculate", "instalment", "emi", "monthly payment", "loan calculator"]
        if any(kw in text_lower for kw in loan_calc_keywords):
            return "loan_instalment_calculation", 0.95, 1.0

        # ML prediction
        cleaned = self.preprocess_text(text)
        features = self.vectorizer.transform([cleaned])
        prediction = self.model.predict(features)[0]

        # Get confidence score
        probabilities = self.model.predict_proba(features)[0]
        confidence = max(probabilities)
        
        # Calculate similarity score against training set
        similarity = 0.0
        if hasattr(self, 'train_vectors') and self.train_vectors is not None:
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(features, self.train_vectors)
            similarity = float(similarities.max())
        

        # If confidence is too low, mark as unknown
        if confidence < 0.65:
            return "unknown", float(confidence), similarity

        return prediction, float(confidence), similarity


    def get_budget_advice(self, text):
        # Generate personalized budget advice if salary is mentioned
        numbers = re.findall(r'[\d,]+', text.replace(',', ''))
        if numbers:
            salary = float(numbers[0].replace(',', ''))
            needs = salary * 0.50
            wants = salary * 0.30
            savings = salary * 0.20

            return (
                f"Based on a monthly income of LKR {salary:,.2f}, here's a suggested budget using the 50/30/20 rule:\n\n"
                f"- Needs (50%): LKR {needs:,.2f} (rent, food, utilities, transport)\n"
                f"- Wants (30%): LKR {wants:,.2f} (entertainment, dining, shopping)\n"
                f"- Savings (20%): LKR {savings:,.2f} (emergency fund, FDs, investments)\n\n"
                f"Tips:\n"
                f"- Try to save at least LKR {savings:,.2f} every month\n"
                f"- Build an emergency fund of LKR {salary * 3:,.2f} - {salary * 6:,.2f}\n"
                f"- Consider opening a Fixed Deposit with your savings for higher interest"
            )
        return None
