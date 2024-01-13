from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_login import LoginManager, UserMixin, login_user, current_user, login_required, logout_user
import requests, base64, config, threading, time


app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.secret_key = config.secret_key

# User class and database
class User(UserMixin):
    def __init__(self, user_id, username, password):
        self.id = user_id
        self.username = username
        self.password = password

users_db = {
    1: User(1, 'john_doe', 'password123'),
    2: User(2, 'jane_smith', 'letmein')
}

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return users_db.get(int(user_id))

# active_users_count = 0
# active_users_lock = threading.Lock()

# def update_active_users_count():
#     global active_users_count
#     while True:
#         time.sleep(1)
#         with active_users_lock:
#             active_users_count += 1

# threading.Thread(target=update_active_users_count, daemon=True).start()

# @app.route('/api/active_users_count')
# def api_active_users_count():
#     with active_users_lock:
#         return jsonify({'active_users_count': active_users_count})



CLIENT_ID = config.CLIENT_ID
CLIENT_SECRET = config.CLIENT_SECRET

CLIENT_CREDENTIALS = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()

def get_spotify_access_token():
    token_url = 'https://accounts.spotify.com/api/token'
    headers = {
        'Authorization': f'Basic {CLIENT_CREDENTIALS}',
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    data = {'grant_type': 'client_credentials'}

    response = requests.post(token_url, headers=headers, data=data)
    response_data = response.json()
    return response_data.get('access_token')

def get_spotify_album_cover(api_key, artist, track_name):
    base_url = 'https://api.spotify.com/v1/search'
    
    access_token = get_spotify_access_token()

    params = {
        'q': f'{artist} {track_name}',
        'type': 'track',
        'limit': 1,
    }

    headers = {
        'Authorization': f'Bearer {access_token}',
    }

    try:
        response = requests.get(base_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

        if 'tracks' in data and 'items' in data['tracks']:
            track_info = data['tracks']['items'][0]
            album_info = track_info.get('album', {})
            images = album_info.get('images', [])

            if images:
                album_cover = images[0]['url']
                return album_cover
    except requests.exceptions.RequestException as e:
        return None

def get_top_tracks(api_key, limit=4):
    base_url = 'http://ws.audioscrobbler.com/2.0/'
    method = 'chart.getTopTracks'

    params = {
        'method': method,
        'api_key': api_key,
        'format': 'json',
        'limit': limit,
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        if 'tracks' in data and 'track' in data['tracks']:
            top_tracks = data['tracks']['track']
            return top_tracks
        else:
            print(f"Error: {data.get('message', 'Unknown error')}")
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None

def get_processed_top_tracks(api_key_lastfm, limit=4):
    top_tracks = get_top_tracks(api_key_lastfm, limit=limit)

    for item in top_tracks:
        artist = item['artist']['name']
        track_name = item['name']

        album_cover = get_spotify_album_cover(api_key_lastfm, artist, track_name)
        item['album_cover'] = album_cover if album_cover else ''
        item['artist'] = artist

    return top_tracks

@app.route('/api/top_tracks')
def api_top_tracks():
    api_key_lastfm = config.api_key_lastfm
    limit = int(request.args.get('limit', 4))

    top_tracks = get_processed_top_tracks(api_key_lastfm, limit=limit)

    return jsonify(top_tracks)

@app.route('/api/fetch_data')
def api_fetch_data():
    api_key_lastfm = config.api_key_lastfm

    top_tracks = get_processed_top_tracks(api_key_lastfm, limit=4)

    return jsonify({'top_tracks': top_tracks})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = next((u for u in users_db.values() if u.username == username and u.password == password), None)
        if user:
            login_user(user)
            return redirect(url_for('profile'))
        return 'Invalid username or password'
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/profile')
@login_required
def profile():
    return f'Hello, {current_user.username}!'

if __name__ == '__main__':
    app.run(debug=True)
