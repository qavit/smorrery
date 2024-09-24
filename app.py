from flask import Flask, jsonify, render_template
import requests

app = Flask(__name__)

# 路由：查詢 10 個 Apollo 小行星
@app.route('/api/small_bodies')
def get_small_bodies():
    # 更新 SBDB Query API 的查詢 URL 和參數
    api_url = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
    params = {
        'fields': 'full_name,epoch,e,a,q,i,om,w',  # 更新欄位
        'sb-class': 'IEO',  # 查詢 IEO 類型的小行星
        'limit': 10  # 你可以保留限制為 10 個結果
    }

    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        data = response.json()
        print(data)
        return jsonify(data)
    else:
        print(f"Error {response.status_code}: {response.text}")
        return jsonify({"error": "Unable to fetch data", "details": response.text}), response.status_code


# 路由：渲染前端的 HTML
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
