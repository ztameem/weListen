document.addEventListener('DOMContentLoaded', function() {
    var user = {};

    function fetchData() {
        fetch('/api/fetch_data')
            .then(response => response.json())
            .then(data => {
                updateHTML(data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    function updateHTML(data) {
        const trendingCardsContainer = document.getElementById('trending-cards-container');

        trendingCardsContainer.innerHTML = '';
        const topTracks = data.top_tracks;
        const localSongs = data.local_songs;
    
        topTracks.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('trending-card');

            // Checking if there's an album cover
            if (item.album_cover) {
                const img = document.createElement('img');
                img.classList.add('album_cover');
                img.src = item.album_cover;
                img.alt = 'Album Cover';
                img.style.cssText = 'width:100%;height:auto; border-radius: 8px; box-shadow: #3882F6 1px 0 20px';
                card.appendChild(img);
            }

            const cardText = document.createElement('div');
            cardText.classList.add('card-text');

            // Checking if item has artist and name properties
            if (item.artist && item.name) {
                const artistHeading = document.createElement('h3');
                artistHeading.textContent = item.artist;

                const trackParagraph = document.createElement('p');
                trackParagraph.textContent = item.name;

                cardText.appendChild(artistHeading);
                cardText.appendChild(trackParagraph);
            }

            card.appendChild(cardText);
            trendingCardsContainer.appendChild(card);
            displaySongs(localSongs);
        });
    }

    fetchData();

    const emoji = document.querySelector('.emoji');
    const text = document.querySelector('.text');

    sidebar.addEventListener('mouseenter', function () {
        emoji.style.display = 'none';
        text.style.display = 'inline';
    });

    sidebar.addEventListener('mouseleave', function () {
        emoji.style.display = 'inline';
        text.style.display = 'none';
    });

    var messageInput = document.getElementById('message-input');

    function getRoomIdFromUrl() {
        var pathArray = window.location.pathname.split('/');
        var roomIdIndex = pathArray.indexOf('room') + 1;
        
        if (roomIdIndex < pathArray.length) {
            return pathArray[roomIdIndex];
        } else {
            return null;
        }
    }
    
    var roomId = getRoomIdFromUrl();
    console.log('Room ID:', roomId);

    var userNumber;

    var socket = io.connect('http://127.0.0.1:5000/', { query: { room_id: roomId } });

    function sendMessage(messageText) {
        let room_id = window.location.pathname.split('/').pop();
        socket.emit('message', { room_id: room_id, message: messageText, userNumber: userNumber });
    }

    socket.on('connect', function () {
        socket.emit('request_user_number');
        socket.emit('request_queued_songs');
    });

    socket.on('update_queue', function (data) {
        const queuedSongs = data.queuedSongs;
        updateQueueList(queuedSongs);
    });    

    window.onbeforeunload = function() {
        socket.emit('user_left', { userNumber: userNumber });
    };

    socket.on('assign_user_number', function (data) {
        userNumber = data.userNumber;
    });

    var activeUsersCounter = document.getElementById('active-users-counter');

    socket.on('user_joined', function (data) {
        var notification = document.createElement('li');
        var username = data.username ? data.username : `Guest${data.userNumber}`;
        notification.textContent = `${username} has joined the jam!`;
        notification.classList.add('user-joined-notification');
        document.getElementById('chat-messages').appendChild(notification);
        updateActiveUsersCounter(data.userNumber);
    });

    socket.on('user_left', function (data) {
        var notification = document.createElement('li');
        var username = data.username ? data.username : `Guest${data.userNumber}`;
        notification.textContent = `${username} left the jam!`;
        notification.classList.add('user-left-notification');
        document.getElementById('chat-messages').appendChild(notification);
        updateActiveUsersCounter(data.userCount)
    });
    

    function updateActiveUsersCounter(userCount) {
        activeUsersCounter.textContent = `${userCount} users online`;
    }
    
    function receiveMessage(data) {
        var li = document.createElement('li');
        
        var guestSpan = document.createElement('span');
        guestSpan.textContent = `Guest${data.userNumber}: `;
        
    guestSpan.style.color = 'gray'; 

        li.appendChild(guestSpan);
        
        li.appendChild(document.createTextNode(data.message));
        
        li.classList.add('chat-message');
    
        document.getElementById('chat-messages').appendChild(li);
    }

    socket.on('message', function (data) {
        console.log('Received message:', data);
        receiveMessage(data);
    });


    messageInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            var messageText = messageInput.value.trim();
            if (messageText !== '') {
                sendMessage(messageText);
                // Clear the input field
                messageInput.value = '';
            }
        }
    });

    const queueButton = document.getElementById('queue-button');
    const closeQueueButton = document.getElementById('close-popup');
    const searchInput = document.getElementById('search-input'); 


    queueButton.addEventListener('click', openQueuePopup);
    closeQueueButton.addEventListener('click', closeQueuePopup)
    searchInput.addEventListener('input', searchSongs);


    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeQueuePopup();
        }
    });

    function openQueuePopup() {
        const queuePopup = document.getElementById('queue-popup');
        const overlay = document.getElementById('overlay');
        queuePopup.style.display = 'block';
        overlay.style.display = 'block';
    }
    
    function closeQueuePopup() {
        const queuePopup = document.getElementById('queue-popup');
        const overlay = document.getElementById('overlay');
        queuePopup.style.display = 'none';
        overlay.style.display = 'none';
    }

    async function searchSongs() {
        const query = document.getElementById('search-input').value;
        const response = await fetch(`/api/search_songs?query=${query}`);
        const songs = await response.json();
        updateSearchResults(songs);
    }

    function updateSearchResults(songs) {
        const localSongsContainer = document.getElementById('local-songs-container');
        localSongsContainer.innerHTML = '';

        songs.forEach(song => {
            const songElement = document.createElement('div');
            songElement.innerHTML = `<p>${song.name} - ${song.artist}</p>`;
            localSongsContainer.appendChild(songElement);
        });
    }

    function queueSong(songName, artist) {
        // Check if the queue is empty
        if (queuedSongs.length === 0) {
            // If the queue is empty, play the selected song
            socket.emit('queue_song', { songName, artist });
        } else {
            // If the queue is not empty, add the song to the queue list
            socket.emit('queue_song', { songName, artist });
        }
    }
    
    // Function to update the queue list on the right side
    function updateQueueList(queuedSongs) {
        const queueList = document.getElementById('queued-songs');
        queueList.innerHTML = ''; // Clear existing list
    
        // Iterate through queued songs and add them to the list
        queuedSongs.forEach((song, index) => {
            const listItem = document.createElement('div');
            listItem.textContent = `${index + 1}. ${song.songName} - ${song.artist}`;
            queueList.appendChild(listItem);
        });
    }
    
    // Add an event listener to the "Queue" button
    document.getElementById('queue-button').addEventListener('click', function () {
        const songName = document.getElementById('search-input').value;
        const artist = ''; // You can get artist from user input or other sources
    
        if (songName.trim() !== '') {
            queueSong(songName, artist);
        }
    });
    

});

function showCreateRoomPopup() {
    document.getElementById('create-room-popup').style.display = 'block';
}

function hideCreateRoomPopup() {
    document.getElementById('create-room-popup').style.display = 'none';
}

function createRoom() {
    const roomName = document.getElementById('room-name').value;
    const genre = document.getElementById('genre').value;
    const roomType = document.querySelector('input[name="room-type"]:checked').value;

    const data = {
        roomName: roomName,
        genre: genre,
        roomType: roomType
    };

    fetch('/api/create_room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Redirect to the newly created room
                window.location.href = `/room/${data.roomId}`;
            } else {
                console.error(data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });

}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        createRoom();
    }
}

let sidebar = document.getElementById('room-sidebar');

document.addEventListener('mousemove', function (event) {
    let x = event.clientX;
    if (x <= 100) {
        document.getElementById('room-sidebar').classList.add('active');
    }
});
sidebar.addEventListener('mouseleave', function () {
    sidebar.classList.remove('active');
});



