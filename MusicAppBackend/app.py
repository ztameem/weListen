from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_login import LoginManager, login_user, current_user, login_required, logout_user
from flask_sqlalchemy import SQLAlchemy
import base64, config, requests, uuid
from flask_socketio import SocketIO, emit, join_room


app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.secret_key = config.secret_key
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db = SQLAlchemy(app)
socketio = SocketIO(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)

class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    genre = db.Column(db.String(50), nullable=False)
    guest_allowed = db.Column(db.Boolean, default=True)
    users = db.relationship('User', secondary='user_room', lazy='dynamic')

user_room = db.Table('user_room',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('room_id', db.Integer, db.ForeignKey('room.id'))
)

@app.route('/home')
def home_room():
    rooms = Room.query.all()
    return render_template('home.html', rooms=rooms)

@app.route('/api/create_room', methods=['POST'])
def create_room():
    data = request.json
    room_name = data.get('roomName')
    genre = data.get('genre')
    room_type = data.get('roomType')

    new_room = Room(name=room_name, genre=genre, guest_allowed=(room_type == 'public'))

    try:
        db.session.add(new_room)
        db.session.commit()
        socketio.emit('room_created', {'room_id': new_room.id}, namespace='/')

        return jsonify({'success': True, 'roomId': new_room.id, 'message': 'Room created successfully'})
    except Exception as e:
        print(f"Error creating room: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Failed to create room'})


@app.route('/room/<int:room_id>', methods=['GET', 'POST'])
def room(room_id):
    room = Room.query.get(room_id)
    if not room:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username')
        if username:
            user = User.query.filter_by(username=username).first()
            if not user:
                user = User(username=username)
                db.session.add(user)
                db.session.commit()

            # Add the user to the room
            if room.guest_allowed or user in room.users:
                room.users.append(user)
                db.session.commit()
                return redirect(url_for('room', room_id=room_id))
            else:
                return jsonify({'success': False, 'error': 'Guests not allowed in this room'})

    return render_template('room.html', room=room)


@socketio.on('message')
def handle_message(data):
    emit('message', {'message': data['message'], 'userNumber': data['userNumber']}, room=data['room_id'])

@socketio.on('connect')
def handle_connect():
    room_id = request.args.get('room_id')
    user_id = str(uuid.uuid4())
    join_room(room_id)


    emit('user_info', {'user_id': user_id})


@socketio.on('request_user_number')
def handle_request_user_number():
    room_id = request.args.get('room_id') 
    user_number = assign_user_number(room_id)
    emit('assign_user_number', {'userNumber': user_number}, room=request.sid)
    emit('user_joined', {'userNumber': user_number}, room=room_id, broadcast=True)

room_user_numbers = {}

def assign_user_number(room_id):
    if room_id not in room_user_numbers:
        room_user_numbers[room_id] = {}

    user_socket_id = request.sid

    if user_socket_id not in room_user_numbers[room_id]:
        user_number = len(room_user_numbers[room_id]) + 1
        room_user_numbers[room_id][user_socket_id] = user_number

    return room_user_numbers[room_id][user_socket_id]


login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
    with app.app_context():
        db.create_all()
    app.run(debug=True)
