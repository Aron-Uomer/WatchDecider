import axios from 'axios';

const BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const api = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

export const GENRES = {
  MOVIE: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
  ],
  TV: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' },
  ],
  ANIME: [
    { id: 33446, name: 'Shonen (Action)' },
    { id: 33447, name: 'Seinen (Gritty)' },
    { id: 33448, name: 'Shoujo (Romance)' },
    { id: 216262, name: 'Isekai' },
    { id: 14459, name: 'Mecha' },
    { id: 156321, name: 'Slice of Life' },
    { id: 6075, name: 'Sports' },
    { id: 10765, name: 'Fantasy' },
    { id: 9648, name: 'Psychological' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 27, name: 'Horror' },
  ]
};

const MOOD_FILTERS = {
  funny: [35],
  dark: [27, 80, 53],
  emotional: [10749, 18],
  mind_blowing: [878, 9648, 14],
};

export const fetchRecommendations = async (filters) => {
  const { type, genres = [], mood, yearRange, excludeIds = [] } = filters;
  
  let endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
  
  // Combine user selected genres with mood-based genres
  let activeIds = [...genres];
  if (mood && MOOD_FILTERS[mood]) {
    activeIds = [...new Set([...activeIds, ...MOOD_FILTERS[mood]])];
  }

  // TMDB has IDs and Keywords. Let's separate them.
  // We'll treat things as keywords if they are known anime keywords or > 2000
  const keywords = activeIds.filter(id => [216262, 14459, 33447, 33448, 156321, 33446, 6075].includes(id));
  const genreIds = activeIds.filter(id => !keywords.includes(id));

  const params = {
    with_genres: genreIds.join(','),
    with_keywords: keywords.join(','),
    sort_by: 'popularity.desc',
    'vote_average.gte': filters.useRatingFilter ? (filters.minRating || 6.5) : 0,
    'vote_count.gte': filters.useRatingFilter ? (type === 'movie' ? 200 : 50) : 0,
    page: Math.floor(Math.random() * 5) + 1,
  };

  if (type === 'anime') {
    endpoint = '/discover/tv';
    params.with_genres = [...new Set([...genreIds, 16])].join(',');
    params.with_original_language = 'ja';
    // Add anime specific keyword if not already searching by keyword
    if (!params.with_keywords) params.with_keywords = '210024';
  }

  if (filters.useYearFilter) {
    if (type === 'movie' && yearRange) {
      params['primary_release_date.gte'] = `${yearRange[0]}-01-01`;
      params['primary_release_date.lte'] = `${yearRange[1]}-12-31`;
    } else if ((type === 'tv' || type === 'anime') && yearRange) {
      params['first_air_date.gte'] = `${yearRange[0]}-01-01`;
      params['first_air_date.lte'] = `${yearRange[1]}-12-31`;
    }
  }

  try {
    const response = await api.get(endpoint, { params });
    let results = response.data.results || [];

    // Filter out excluded IDs
    if (excludeIds.length > 0) {
      results = results.filter(item => !excludeIds.includes(item.id));
    }
    
    // Shuffle and take 3
    const shuffled = results.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(item => ({
      id: item.id,
      title: item.title || item.name,
      description: item.overview,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://placehold.co/500x750/1e293b/64748b?text=No+Poster',
      rating: item.vote_average,
      releaseDate: item.release_date || item.first_air_date,
      genreIds: item.genre_ids,
      type,
      reason: getWhyReason(item)
    }));
  } catch (error) {
    console.error('TMDB Fetch Error:', error);
    throw new Error("Failed to fetch recommendations.");
  }
};

export const fetchTVDetails = async (id) => {
  try {
    const response = await api.get(`/tv/${id}`);
    return response.data;
  } catch (error) {
    console.error('TMDB Details Error:', error);
    return null;
  }
};

const getWhyReason = (item) => {
  const allGenres = [...GENRES.MOVIE, ...GENRES.TV, ...GENRES.ANIME];
  const ids = item.genre_ids || [];
  const genreNames = ids
    .map(id => allGenres.find(g => g.id === id)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index); // Unique names
  
  if (genreNames.length > 0) {
    return genreNames.join(' • ');
  }
  
  return "Highly-rated recommendation";
};
