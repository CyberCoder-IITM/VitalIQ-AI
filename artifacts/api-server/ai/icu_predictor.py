"""ICU admission probability predictor using sklearn LogisticRegression trained on synthetic data."""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from models.schemas import VitalSigns, Patient, NEWS2Result, ICUPrediction, RiskCategory


class ICUPredictor:
    def __init__(self):
        self.model = LogisticRegression(random_state=42, max_iter=1000, C=1.0)
        self.scaler = StandardScaler()
        self.feature_names = [
            "news2_score", "age", "heart_rate", "systolic_bp",
            "respiratory_rate", "spo2", "temperature", "gcs",
            "num_conditions", "num_medications",
        ]
        self._train()

    def _generate_training_data(self, n: int = 1000):
        rng = np.random.RandomState(42)

        news2 = rng.randint(0, 16, n).astype(float)
        age = rng.randint(18, 95, n).astype(float)
        hr = rng.normal(85, 25, n).clip(25, 220)
        sbp = rng.normal(120, 30, n).clip(50, 240)
        rr = rng.normal(16, 5, n).clip(4, 50)
        spo2 = rng.normal(95, 4, n).clip(70, 100)
        temp = rng.normal(37.0, 0.8, n).clip(34.0, 41.0)
        gcs = rng.randint(6, 16, n).astype(float)
        num_cond = rng.randint(0, 8, n).astype(float)
        num_meds = rng.randint(0, 12, n).astype(float)

        X = np.column_stack([news2, age, hr, sbp, rr, spo2, temp, gcs, num_cond, num_meds])

        # Labeling logic per spec
        y = (
            (news2 >= 7)
            | (sbp < 80)
            | (spo2 < 85)
            | (gcs < 10)
            | ((news2 >= 5) & (age > 65))
        ).astype(int)

        # 10% noise
        noise_idx = rng.choice(n, size=int(n * 0.10), replace=False)
        y[noise_idx] = 1 - y[noise_idx]

        return X, y

    def _train(self):
        X, y = self._generate_training_data(1000)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def predict(self, vitals: VitalSigns, patient: Patient, news2: NEWS2Result) -> ICUPrediction:
        features = np.array([[
            news2.score,
            patient.age,
            vitals.heart_rate,
            vitals.systolic_bp,
            vitals.respiratory_rate,
            vitals.spo2,
            vitals.temperature,
            vitals.gcs,
            len(patient.active_conditions),
            len(patient.current_medications),
        ]])

        features_scaled = self.scaler.transform(features)
        prob = float(self.model.predict_proba(features_scaled)[0][1])
        prob = max(0.01, min(0.99, prob))
        percentage = int(round(prob * 100))

        if percentage < 25:
            risk_category = RiskCategory.LOW
            recommendation = "Stable for floor admission or observation. Re-evaluate if NEWS2 worsens."
        elif percentage < 50:
            risk_category = RiskCategory.MODERATE
            recommendation = "Consider step-down unit. Senior physician review recommended within 30 minutes."
        elif percentage < 75:
            risk_category = RiskCategory.HIGH
            recommendation = "Strong consideration for ICU admission. Notify intensivist immediately."
        else:
            risk_category = RiskCategory.VERY_HIGH
            recommendation = "Immediate ICU admission indicated. Alert ICU attending NOW."

        # Confidence interval (approximate Wilson interval)
        n_eff = 50
        z = 1.96
        ci_low = max(0.0, (prob + z**2/(2*n_eff) - z * np.sqrt((prob*(1-prob) + z**2/(4*n_eff))/n_eff)) / (1 + z**2/n_eff))
        ci_high = min(1.0, (prob + z**2/(2*n_eff) + z * np.sqrt((prob*(1-prob) + z**2/(4*n_eff))/n_eff)) / (1 + z**2/n_eff))

        # Top 3 contributing factors
        coefs = self.model.coef_[0]
        feat_vals = features_scaled[0]
        contributions = [(abs(coefs[i] * feat_vals[i]), self.feature_names[i], features[0][i]) for i in range(len(self.feature_names))]
        contributions.sort(reverse=True)
        key_factors = []
        for _, name, val in contributions[:3]:
            label = name.replace("_", " ").title()
            if name == "news2_score":
                key_factors.append(f"NEWS2: {int(val)}")
            elif name == "age":
                key_factors.append(f"Age: {int(val)}")
            elif name == "spo2":
                key_factors.append(f"SpO2: {val:.0f}%")
            elif name == "systolic_bp":
                key_factors.append(f"SBP: {val:.0f} mmHg")
            elif name == "heart_rate":
                key_factors.append(f"HR: {val:.0f} bpm")
            elif name == "gcs":
                key_factors.append(f"GCS: {int(val)}")
            elif name == "respiratory_rate":
                key_factors.append(f"RR: {val:.0f}/min")
            else:
                key_factors.append(f"{label}: {val:.1f}")

        return ICUPrediction(
            patient_id=vitals.patient_id,
            probability=round(prob, 3),
            percentage=percentage,
            risk_category=risk_category,
            key_factors=key_factors,
            confidence_interval_low=round(ci_low, 3),
            confidence_interval_high=round(ci_high, 3),
            recommendation=recommendation,
        )


# Singleton
_predictor: ICUPredictor | None = None


def get_predictor() -> ICUPredictor:
    global _predictor
    if _predictor is None:
        _predictor = ICUPredictor()
    return _predictor
