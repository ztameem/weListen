

document.addEventListener('DOMContentLoaded', function() {
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

    // function updateActiveUsers(activeUsersCount) {
    //     const activeUsersElement = document.getElementById('active-users');
    //     if (activeUsersElement) {
    //         activeUsersElement.textContent = activeUsersCount;
    //     }
    // }

    fetchData();

    // function pollActiveUsers() {
    //     fetch('/api/active_users_count')
    //         .then(response => response.json())
    //         .then(data => {
    //             updateActiveUsers(data.active_users_count);
    //             setTimeout(pollActiveUsers, 1000); 
    //         })
    //         .catch(error => {
    //             console.error('Error:', error);
    //         });
    // }

    // pollActiveUsers();

});
