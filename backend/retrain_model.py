import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
import joblib
import os
import re

def preprocess_text(text):
    """Clean and preprocess text for training."""
    text = str(text).lower().strip()
    text = re.sub(r'[^a-z0-9\s]', '', text)  # Remove special characters
    text = re.sub(r'\s+', ' ', text)  # Remove extra spaces
    return text

def execute_retraining():
    # Retrain the Decision Tree model using TF-IDF features on updated CSV
    
    from database import engine
    query = "SELECT question, intent FROM training_data WHERE approved = true"
    df = pd.read_sql(query, engine)
    
    # Drop duplicates if any slipped through
    df.drop_duplicates(subset=['question'], inplace=True)
    
    df['cleaned'] = df['question'].apply(preprocess_text)
    
    # TF-IDF Vectorization
    vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
    X = vectorizer.fit_transform(df['cleaned'])
    y = df['intent']
    
    # Train Decision Tree Classifier on full data
    model = DecisionTreeClassifier(
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42
    )
    model.fit(X, y)
    
    # Save model and vectorizer, overwriting old ones
    model_dir = os.path.join(os.path.dirname(__file__), "ml_model")
    os.makedirs(model_dir, exist_ok=True)
    
    joblib.dump(model, os.path.join(model_dir, "intent_model.joblib"))
    joblib.dump(vectorizer, os.path.join(model_dir, "tfidf_vectorizer.joblib"))
    print("Retraining completed and model overwritten.")

if __name__ == "__main__":
    execute_retraining()
