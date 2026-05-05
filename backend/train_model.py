import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os
import re


def preprocess_text(text):
    # Clean and preprocess text for training
    text = str(text).lower().strip()
    text = re.sub(r'[^a-z0-9\s]', '', text)  # Remove special characters
    text = re.sub(r'\s+', ' ', text)  # Remove extra spaces
    return text


def train_model():
    # Train the Decision Tree model using TF-IDF features

    # Step 1: Load training data from PostgreSQL
    from database import engine
    query = "SELECT question, intent FROM training_data WHERE approved = true"
    df = pd.read_sql(query, engine)
    print(f"Loaded {len(df)} training samples")
    print(f"Intents found: {df['intent'].nunique()}")
    print(f"Intent distribution:\n{df['intent'].value_counts()}\n")

    # Step 2: Preprocess questions
    df['cleaned'] = df['question'].apply(preprocess_text)

    # Step 3: TF-IDF Vectorization
    vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
    X = vectorizer.fit_transform(df['cleaned'])
    y = df['intent']

    # Step 4: Split data for training and testing
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Step 5: Train Decision Tree Classifier
    model = DecisionTreeClassifier(
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Step 6: Evaluate model
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Model Accuracy: {accuracy * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    # Re-train on FULL dataset before saving to ensure all edge cases are learned
    model.fit(X, y)

    # Step 7: Save model and vectorizer
    model_dir = os.path.join(os.path.dirname(__file__), "ml_model")
    os.makedirs(model_dir, exist_ok=True)

    joblib.dump(model, os.path.join(model_dir, "intent_model.joblib"))
    joblib.dump(vectorizer, os.path.join(model_dir, "tfidf_vectorizer.joblib"))
    print(f"Model saved to {model_dir}/")
    print("Training complete!")


if __name__ == "__main__":
    train_model()
