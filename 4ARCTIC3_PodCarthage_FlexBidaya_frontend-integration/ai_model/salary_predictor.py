import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ==========================================================
# 1. IMPLÉMENTATION "FROM SCRATCH" (MATHÉMATIQUES MANUELLES)
# ==========================================================
# IMPORTANT : Nous n'utilisons PAS scikit-learn. 
# NumPy est une bibliothèque de calcul mathématique de base, 
# pas une bibliothèque d'IA prête à l'emploi.

# Données d'entraînement (Score IA vs Salaire TND)
X = np.array([30, 50, 65, 80, 95, 100])
Y = np.array([800, 1200, 1800, 2500, 3500, 4000])

def train_manual_linear_regression(x, y):
    """
    Calcule manuellement la pente (m) et l'ordonnée à l'origine (b)
    Formule : y = mx + b
    """
    n = len(x)
    mean_x = np.mean(x)
    mean_y = np.mean(y)
    
    # Calcul de la pente m
    # m = sum((x - mean_x) * (y - mean_y)) / sum((x - mean_x)^2)
    numerator = np.sum((x - mean_x) * (y - mean_y))
    denominator = np.sum((x - mean_x)**2)
    m = numerator / denominator
    
    # Calcul de b
    # b = mean_y - m * mean_x
    b = mean_y - (m * mean_x)
    
    return m, b

# Calcul des paramètres au démarrage du serveur
m, b = train_manual_linear_regression(X, Y)

print("✅ Modèle réimplémenté FROM SCRATCH (Maths manuelles) !")
print(f"📈 Relation détectée : Salaire = ({m:.2f} * Score) + {b:.2f}")

# ==========================================
# 2. API WEB (FLASK)
# ==========================================

@app.route('/api/predict-salary', methods=['POST'])
def predict_salary():
    try:
        data = request.get_json()
        score_ia = data.get('scoreIA', 0)
        
        # Sécurité : Limiter le score entre 0 et 100
        score_ia = max(0, min(100, score_ia))

        # Prédiction manuelle : y = mx + b
        salaire_predit = (m * score_ia) + b
        
        # Arrondi psychologique à 50 TND près
        salaire_arrondi = int(round(salaire_predit / 50) * 50)

        # Analyse qualitative
        if score_ia >= 85:
            analyse = "Profil d'Excellence. Proposition salariale Haute."
        elif score_ia >= 65:
            analyse = "Profil Compétent. Proposition Standard Marché."
        else:
            analyse = "Profil Junior / Débutant. Proposition Base Échelle."

        return jsonify({
            "score_ia": score_ia,
            "salaire_estime_tnd": salaire_arrondi,
            "analyse_ia": analyse,
            "algorithme": "Linear Regression FROM SCRATCH (Mathématiques pures)",
            "formule": f"y = {m:.2f}x + {b:.2f}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("==================================================")
    print("🌍 SERVEUR IA 'FROM SCRATCH' SUR http://localhost:5000")
    print("==================================================")
    app.run(port=5000, debug=True)
