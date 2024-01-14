document.addEventListener('DOMContentLoaded', function() {

    var user = {};

    function fetchData() {
        fetch('/api/top_tracks')
            .then(response => response.json())
            .then(data => {
                updateHTML(data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    function updateHTML(topTracks) {
        const trendingCardsContainer = document.getElementById('trending-cards-container');

        trendingCardsContainer.innerHTML = '';

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
        });
    }

    fetchData();

    const homeButton = document.getElementById('home-button');
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
    var chatMessages = document.getElementById('chat-messages');

    function getRoomIdFromUrl() {
        var pathArray = window.location.pathname.split('/');
        var roomIdIndex = pathArray.indexOf('room') + 1;
        
        if (roomIdIndex < pathArray.length) {
            return pathArray[roomIdIndex];
        } else {
            return null;
        }
    }
    
    // Usage example
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
    });

    socket.on('assign_user_number', function (data) {
        userNumber = data.userNumber;
    });

    socket.on('user_joined', function (data) {
        var notification = document.createElement('li');
        var username = data.username ? data.username : `Guest${data.userNumber}`;
        notification.textContent = `${username} has joined the jam!`;
        notification.classList.add('user-joined-notification');
        document.getElementById('chat-messages').appendChild(notification);
    });
    
    function receiveMessage(data) {
        var guestNumber = userNumber;
        var li = document.createElement('li');
        
        var guestSpan = document.createElement('span');
        guestSpan.textContent = `Guest${data.userNumber}: `;
        
    guestSpan.style.color = 'gray'; 

        li.appendChild(guestSpan);
        
        li.appendChild(document.createTextNode(data.message));
        
        li.classList.add('chat-message');
    
        document.getElementById('chat-messages').appendChild(li);
    }

    function generateUniqueNumber() {
        var number;
        do {
            number = Math.floor(Math.random() * 900) + 100;
        } while (usedNumbers.includes(number)); 

        return number;
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
