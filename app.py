from flask import Flask, jsonify, render_template, request, g
import requests
from flask_babel import Babel, gettext, force_locale

app = Flask(__name__)

# Set default locale and supported locales
app.config['BABEL_DEFAULT_LOCALE'] = 'en'
app.config['BABEL_SUPPORTED_LOCALES'] = ['en', 'zh_TW']

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
def get_data():
    # SBDB Query API URL and parameters
    api_url = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
    params = {
        'fields': 'full_name,epoch,e,a,q,i,om,w,ma',  # Fields to query
        'sb-group': 'neo',  # NEOs-only (neo) or PHAs-only (pha)
        'limit': 20  # Limit results to 20
    }

    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        data = response.json()
        print(data)
        return jsonify(data)
    else:
        print(f"Error {response.status_code}: {response.text}")
        return jsonify({"error": "Unable to fetch data", "details": response.text}), response.status_code


# Route: Render the front-end HTML
@app.route('/')
def index():
    return render_template('sheet.html', locale=get_locale())

# Route: Render the Orrery page (3D visualization)
@app.route('/orrery')
def orrery():
    return render_template('orrery8.html', locale=get_locale())

if __name__ == '__main__':
    app.run(debug=True)
