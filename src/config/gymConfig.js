const gymConfig = {
    // Regular Gym Leaders
    gyms: [
        {
            name: 'Rock Gym',
            type: 'rock',
            emoji: '🗿',
            color: '#B8860B',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/boulder-badge.png', // Boulder Badge
            description: 'The Rock-type Gym specializes in sturdy, defensive Pokemon.'
        },
        {
            name: 'Water Gym',
            type: 'water',
            emoji: '🌊',
            color: '#4682B4',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/cascade-badge.png', // Cascade Badge
            description: 'The Water-type Gym flows with powerful aquatic Pokemon.'
        },
        {
            name: 'Electric Gym',
            type: 'electric',
            emoji: '⚡',
            color: '#FFD700',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/thunder-badge.png', // Thunder Badge
            description: 'The Electric-type Gym sparks with shocking Pokemon.'
        },
        {
            name: 'Grass Gym',
            type: 'grass',
            emoji: '🌿',
            color: '#228B22',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rainbow-badge.png', // Rainbow Badge
            description: 'The Grass-type Gym blooms with natural Pokemon.'
        },
        {
            name: 'Poison Gym',
            type: 'poison',
            emoji: '☠️',
            color: '#8B008B',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soul-badge.png', // Soul Badge
            description: 'The Poison-type Gym is filled with toxic Pokemon.'
        },
        {
            name: 'Psychic Gym',
            type: 'psychic',
            emoji: '🔮',
            color: '#FF1493',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/marsh-badge.png', // Marsh Badge
            description: 'The Psychic-type Gym bends reality with mind Pokemon.'
        },
        {
            name: 'Fire Gym',
            type: 'fire',
            emoji: '🔥',
            color: '#FF4500',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/volcano-badge.png', // Volcano Badge
            description: 'The Fire-type Gym burns bright with fiery Pokemon.'
        },
        {
            name: 'Ground Gym',
            type: 'ground',
            emoji: '⛰️',
            color: '#D2691E',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/earth-badge.png', // Earth Badge
            description: 'The Ground-type Gym stands firm with earthen Pokemon.'
        },
        {
            name: 'Flying Gym',
            type: 'flying',
            emoji: '🦅',
            color: '#87CEEB',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/zephyr-badge.png', // Zephyr Badge
            description: 'The Flying-type Gym soars high with aerial Pokemon.'
        },
        {
            name: 'Bug Gym',
            type: 'bug',
            emoji: '🐛',
            color: '#228B22',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hive-badge.png', // Hive Badge
            description: 'The Bug-type Gym swarms with insect Pokemon.'
        },
        {
            name: 'Normal Gym',
            type: 'normal',
            emoji: '⭐',
            color: '#A8A878',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/plain-badge.png', // Plain Badge
            description: 'The Normal-type Gym showcases versatile Pokemon.'
        },
        {
            name: 'Ghost Gym',
            type: 'ghost',
            emoji: '👻',
            color: '#705898',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fog-badge.png', // Fog Badge
            description: 'The Ghost-type Gym haunts with spectral Pokemon.'
        },
        {
            name: 'Steel Gym',
            type: 'steel',
            emoji: '⚙️',
            color: '#B8B8D0',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mineral-badge.png', // Mineral Badge
            description: 'The Steel-type Gym forges strong metallic Pokemon.'
        },
        {
            name: 'Fighting Gym',
            type: 'fighting',
            emoji: '👊',
            color: '#C03028',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/storm-badge.png', // Storm Badge
            description: 'The Fighting-type Gym trains powerful combat Pokemon.'
        },
        {
            name: 'Dark Gym',
            type: 'dark',
            emoji: '🌙',
            color: '#705848',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dark-badge.png', // Dark Badge
            description: 'The Dark-type Gym lurks with shadowy Pokemon.'
        },
        {
            name: 'Dragon Gym',
            type: 'dragon',
            emoji: '🐉',
            color: '#7038F8',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rising-badge.png', // Rising Badge
            description: 'The Dragon-type Gym commands majestic dragon Pokemon.'
        },
        {
            name: 'Ice Gym',
            type: 'ice',
            emoji: '🧊',
            color: '#98D8D8',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/glacier-badge.png', // Glacier Badge
            description: 'The Ice-type Gym freezes opponents with icy Pokemon.'
        },
        {
            name: 'Fairy Gym',
            type: 'fairy',
            emoji: '🧚',
            color: '#EE99AC',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fairy-badge.png', // Fairy Badge
            description: 'The Fairy-type Gym enchants with magical Pokemon.'
        }
    ],
    
    // Elite Four
    eliteFour: [
        {
            name: 'Elite Four - Lorelei',
            type: 'elite-ice',
            emoji: '❄️',
            color: '#B0E0E6',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elite-four-badge.png', // Elite Four Badge
            description: 'Elite Four member specializing in Ice-type Pokemon.'
        },
        {
            name: 'Elite Four - Bruno',
            type: 'elite-fighting',
            emoji: '💪',
            color: '#8B4513',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elite-four-badge.png', // Elite Four Badge
            description: 'Elite Four member specializing in Fighting-type Pokemon.'
        },
        {
            name: 'Elite Four - Agatha',
            type: 'elite-ghost',
            emoji: '👻',
            color: '#4B0082',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elite-four-badge.png', // Elite Four Badge
            description: 'Elite Four member specializing in Ghost-type Pokemon.'
        },
        {
            name: 'Elite Four - Lance',
            type: 'elite-dragon',
            emoji: '🐲',
            color: '#DC143C',
            badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/elite-four-badge.png', // Elite Four Badge
            description: 'Elite Four member specializing in Dragon-type Pokemon.'
        }
    ],
    
    // Champion
    champion: {
        name: 'Champion Hall',
        type: 'champion',
        emoji: '👑',
        color: '#FFD700',
        badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/champion-badge.png', // Champion Badge
        description: 'The ultimate challenge for Pokemon trainers.'
    }
};

module.exports = gymConfig;