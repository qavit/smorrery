import json
from flask import Flask, jsonify, render_template, request, g
import requests
from flask_babel import Babel

app = Flask(__name__)

# Set default locale and supported locales
app.config['BABEL_DEFAULT_LOCALE'] = 'en'
app.config['BABEL_SUPPORTED_LOCALES'] = ['en', 'zh_TW']
sbdb_data = None

# Function to determine the user's preferred language
def get_locale():
    # First, check if there is a 'lang' parameter in the URL
    lang = request.args.get('lang')
    if lang in ['en', 'zh_TW']:
        return lang

    # If no URL parameter, check user settings
    user = getattr(g, 'user', None)
    if user is not None:
        return user.locale

    # Fall back to the best match from the request's Accept-Language header
    return request.accept_languages.best_match(['en', 'zh_TW'])


# Initialize Babel with the new selector functions
babel = Babel(app, locale_selector=get_locale)


# Route: Query some small bodies
@app.route('/api/sbdb_query')
def sbdb_query():
    global sbdb_data
    api_url = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
    params = {
        'fields': 'full_name,epoch,e,a,q,i,om,w,ma',  # Fields to query
        'sb-group': 'neo',  # NEOs-only (neo) or PHAs-only (pha)
        'limit': 20  # Limit results to 20
    }
    # https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,epoch,e,a,q,i,om,w,ma&sb-group=neo&limit=20

    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        sbdb_data = response.json()
        # print(sbdb_data)

        with open('neo20.json', 'w') as f:
            json.dump(sbdb_data, f, indent=4)
        
        return jsonify(sbdb_data)
    else:
        print(f"Error {response.status_code}: {response.text}")
        return jsonify({"error": "Unable to fetch data", "details": response.text}), response.status_code
    
@app.route('/api/sbdb_CA_query')
def sbdb_CA_query():
    global sbdb_CA_data
    date_min = request.args.get('date-min', '2023-10-10') 
    date_max = request.args.get('date-max', '2025-10-10') 
    dist_max = request.args.get('dist-max', '0.05') 

    api_url = 'https://ssd-api.jpl.nasa.gov/cad.api'
    params = {
        'date-min': date_min,
        'date-max': date_max,
        'dist-max': dist_max
    }
    response = requests.get(api_url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        sbdb_CA_data = []
        for item in data.get("data", []):
            sbdb_CA_data.append({
                "des": item[0],     
                "cd": item[3],      
                "dist": item[4]    
            })
        
        with open('neoCA.json', 'w') as f:
            json.dump(sbdb_CA_data, f, indent=4)
        
        return jsonify(sbdb_CA_data)
    else:
        return jsonify({"error": "Unable to fetch data", "details": response.text}), response.status_code



# Route: Render the front-end HTML
@app.route('/')
def index():
    return render_template('sheet.html', locale=get_locale())


# Route: Render the Orrery page (3D visualization)
@app.route('/orrery')
def orrery():
    global sbdb_data

    if sbdb_data is None:
        try:
            with open('neo20.json', 'r') as f:
                sbdb_data = json.load(f)
        except FileNotFoundError:
            return jsonify({"error": "No data available"})
        
    return render_template('orrery.html', locale=get_locale(), data=sbdb_data)


if __name__ == '__main__':
    app.run(debug=True)