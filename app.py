from flask import Flask, jsonify, render_template, request, g
import requests
from flask_babel import Babel, gettext, force_locale

app = Flask(__name__)

# Set default locale and supported locales
app.config['BABEL_DEFAULT_LOCALE'] = 'en'
app.config['BABEL_SUPPORTED_LOCALES'] = ['en', 'zh_TW']

def get_locale():
    lang = request.args.get('lang')
    if lang in ['en', 'zh_TW']:
        return lang
    user = getattr(g, 'user', None)
    if user is not None:
        return user.locale
    return request.accept_languages.best_match(['en', 'zh_TW'])

babel = Babel(app, locale_selector=get_locale)

# Route: Query 10 small bodies
@app.route('/api/sbdb_query')
def get_data():
    api_url = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
    params = {
        'fields': 'full_name,epoch,e,a,q,i,om,w',
        'sb-group': 'neo',
        'limit': 10
    }
    response = requests.get(api_url, params=params)
    if response.status_code == 200:
        data = response.json()
        return jsonify(data)
    else:
        return jsonify({"error": "Unable to fetch data", "details": response.text}), response.status_code

# Route: Render the Orrery page
@app.route('/orrery')
def orrery():
    return render_template('orrery.html', locale=get_locale())

if __name__ == '__main__':
    app.run(debug=True)
