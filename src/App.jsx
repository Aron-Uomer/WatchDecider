import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RefreshCcw, Sparkles, AlertCircle, Heart, Star, Trash2, Home, Play, X, Check, LogIn, Save } from 'lucide-react';
import { fetchRecommendations, fetchTVDetails } from './services/tmdb';
const RecommendationCard = lazy(() => import('./components/RecommendationCard'));
const FilterModal = lazy(() => import('./components/FilterModal'));
const AuthView = lazy(() => import('./components/AuthView'));
import { getSession, getAuthHeaders, logout as authLogout, updateProfile, updatePassword } from './services/auth';
import { LogOut, User as UserIcon } from 'lucide-react';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Liam',
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Olivia',
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Noah',
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Emma',
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Oliver',
  'https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=Ava'
];

const App = () => {
  const [view, setView] = useState('home'); // 'home', 'loading', 'cards'
  const [filters, setFilters] = useState({
    type: 'movie',
    genres: [],
    mood: null,
    yearRange: [1980, 2026],
    minRating: 6.5,
    useRatingFilter: false,
    useYearFilter: false
  });
  const [recommendations, setRecommendations] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [likedItems, setLikedItems] = useState([]);
  const [dislikedItems, setDislikedItems] = useState([]);
  const [seenItems, setSeenItems] = useState([]);
  const [trackingItems, setTrackingItems] = useState([]);
  const [unsavedTracking, setUnsavedTracking] = useState({});

  const [unreadLikesCount, setUnreadLikesCount] = useState(0);
  const [unreadSeenCount, setUnreadSeenCount] = useState(0);
  const [favoritesTab, setFavoritesTab] = useState('likes'); // 'likes' | 'tracking'
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [user, setUser] = useState(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('watchDecider_theme') || 'midnight';
  });

  useEffect(() => {
    localStorage.setItem('watchDecider_theme', theme);
  }, [theme]);

  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [passwordMode, setPasswordMode] = useState('idle'); // idle | sending | code | new_password | success
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const getPrefix = () => user ? `user_${user.id}_` : 'guest_';

  // Initialize Auth
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
    }
  }, []);

  const syncUserData = async (newLikes, newDislikes, newSeen, extra = {}) => {
    const updates = { ...extra };
    if (newLikes) updates.likes = newLikes;
    if (newDislikes) updates.dislikes = newDislikes;
    if (newSeen) updates.seen = newSeen;

    if (!user) {
      if (updates.likes) localStorage.setItem('guest_likes', JSON.stringify(updates.likes));
      if (updates.dislikes) localStorage.setItem('guest_dislikes', JSON.stringify(updates.dislikes));
      if (updates.seen) localStorage.setItem('guest_seen', JSON.stringify(updates.seen));
      if (updates.tracking) localStorage.setItem('guest_tracking', JSON.stringify(updates.tracking));
      return;
    }

    try {
      await fetch(`/api/user/data/${user.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Failed to sync to server', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          const res = await fetch(`/api/user/data/${user.id}`, {
            headers: getAuthHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            setLikedItems(data.likes || []);
            setDislikedItems(data.dislikes || []);
            setSeenItems(data.seen || []);
            setTrackingItems(data.tracking || []);
          }
        } else {
          const savedLikes = JSON.parse(localStorage.getItem('guest_likes') || '[]');
          const savedDislikes = JSON.parse(localStorage.getItem('guest_dislikes') || '[]');
          const savedSeen = JSON.parse(localStorage.getItem('guest_seen') || '[]');
          const savedTracking = JSON.parse(localStorage.getItem('guest_tracking') || '[]');
          setLikedItems(Array.isArray(savedLikes) ? savedLikes : []);
          setDislikedItems(Array.isArray(savedDislikes) ? savedDislikes : []);
          setSeenItems(Array.isArray(savedSeen) ? savedSeen : []);
          setTrackingItems(Array.isArray(savedTracking) ? savedTracking : []);
        }
        setUnreadLikesCount(0);
        setUnreadSeenCount(0);
      } catch (e) {
        setLikedItems([]);
        setDislikedItems([]);
        setSeenItems([]);
      }
    };
    loadData();
  }, [user]);

  const handleDecide = async () => {
    setView('loading');
    setIsLoading(true);
    setError(null);
    setCurrentIndex(0);

    // Simulate 1.5s loading for the "10-second decision" experience
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

    try {
      // Create exclude list
      const excludeIds = [
        ...likedItems.map(i => i.id),
        ...dislikedItems,
        ...seenItems.map(i => i.id)
      ];

      const [results] = await Promise.all([
        fetchRecommendations({ ...filters, excludeIds }),
        minLoadTime
      ]);

      if (results.length === 0) {
        throw new Error("Couldn't find any results. Try broadening your filters!");
      }

      setRecommendations(results);
      setView('cards');
    } catch (err) {
      setError(err.message || "Something went wrong fetching recommendations.");
      setView('home');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = (item) => {
    if (likedItems.find(i => i.id === item.id)) {
      advanceCard();
      return;
    }
    const newLikes = [...likedItems, item];
    setLikedItems(newLikes);
    setUnreadLikesCount(prev => prev + 1);
    syncUserData(newLikes, null, null);
    advanceCard();
  };

  const handleDislike = (item) => {
    if (dislikedItems.includes(item.id)) {
      advanceCard();
      return;
    }
    const newDislikes = [...dislikedItems, item.id];
    setDislikedItems(newDislikes);
    syncUserData(null, newDislikes, null);
    advanceCard();
  };

  const handleMarkAsSeen = (item) => {
    // Remove from likes if it was there
    const updatedLikes = likedItems.filter(i => i.id !== item.id);
    setLikedItems(updatedLikes);

    // Remove from tracking if it was there
    const updatedTracking = trackingItems.filter(i => i.id !== item.id);
    setTrackingItems(updatedTracking);

    // Add to seen
    if (!seenItems.find(i => i.id === item.id)) {
      const newSeen = [...seenItems, item];
      setSeenItems(newSeen);
      setUnreadSeenCount(prev => prev + 1);
      syncUserData(updatedLikes, null, newSeen, { tracking: updatedTracking });
    } else {
      syncUserData(updatedLikes, null, null, { tracking: updatedTracking });
    }
  };

  const handleToggleTracking = async (item) => {
    const isTracking = trackingItems.find(i => i.id === item.id);
    let newTracking;
    if (isTracking) {
      newTracking = trackingItems.filter(i => i.id !== item.id);
      setTrackingItems(newTracking);
      syncUserData(null, null, null, { tracking: newTracking });
    } else {
      // Fetch details to get season/episode counts
      const details = await fetchTVDetails(item.id);
      const trackingInfo = { 
        ...item, 
        season: 1, 
        episode: 1,
        totalSeasons: details?.number_of_seasons || 1,
        seasons: details?.seasons?.map(s => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count
        })).filter(s => s.seasonNumber > 0) || []
      };
      newTracking = [...trackingItems, trackingInfo];
      setTrackingItems(newTracking);
      syncUserData(null, null, null, { tracking: newTracking });
    }
  };

  const handleUpdateTracking = (id, field, delta) => {
    const newTracking = trackingItems.map(item => {
      if (item.id === id) {
        let newVal = (item[field] || 1) + delta;
        
        if (field === 'season') {
          newVal = Math.max(1, Math.min(newVal, item.totalSeasons || 99));
          // If season changes, reset episode to 1 and update episode limit
          return { ...item, season: newVal, episode: 1 };
        } else {
          const currentSeason = item.seasons?.find(s => s.seasonNumber === item.season);
          const maxEpisodes = currentSeason?.episodeCount || 999;
          newVal = Math.max(1, Math.min(newVal, maxEpisodes));
          return { ...item, episode: newVal };
        }
      }
      return item;
    });
    setTrackingItems(newTracking);
    setUnsavedTracking(prev => ({ ...prev, [id]: true }));
  };

  const handleSetTracking = (id, field, value) => {
    const newTracking = trackingItems.map(item => {
      if (item.id === id) {
        if (value === '') return { ...item, [field]: '' };
        
        let newVal = parseInt(value, 10);
        if (isNaN(newVal)) return item;
        
        if (field === 'season') {
          newVal = Math.min(newVal, item.totalSeasons || 99);
          return { ...item, season: newVal };
        } else {
          const currentSeason = item.seasons?.find(s => s.seasonNumber === item.season);
          const maxEpisodes = currentSeason?.episodeCount || 999;
          newVal = Math.min(newVal, maxEpisodes);
          return { ...item, episode: newVal };
        }
      }
      return item;
    });
    setTrackingItems(newTracking);
    setUnsavedTracking(prev => ({ ...prev, [id]: true }));
  };

  const handleSaveTracking = (id) => {
    let sanitizedTracking = [...trackingItems];
    const index = sanitizedTracking.findIndex(item => item.id === id);
    if (index !== -1) {
      if (sanitizedTracking[index].season === '' || sanitizedTracking[index].season < 1) sanitizedTracking[index].season = 1;
      if (sanitizedTracking[index].episode === '' || sanitizedTracking[index].episode < 1) sanitizedTracking[index].episode = 1;
    }
    setTrackingItems(sanitizedTracking);
    syncUserData(null, null, null, { tracking: sanitizedTracking });
    setUnsavedTracking(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleClearHistory = () => {
    setConfirmModal({
      open: true,
      title: "Clear History?",
      message: "This will permanently delete your entire watched history. This action cannot be undone.",
      onConfirm: () => {
        setSeenItems([]);
        setUnreadSeenCount(0);
        syncUserData(null, null, []);
        setConfirmModal(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleResetCollection = () => {
    setConfirmModal({
      open: true,
      title: "Reset Collection?",
      message: "This will remove all your liked items and clear your dislike list. Are you sure you want to start fresh?",
      onConfirm: () => {
        setLikedItems([]);
        setDislikedItems([]);
        setTrackingItems([]);
        setUnreadLikesCount(0);
        syncUserData([], [], null, { tracking: [] });
        setConfirmModal(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setEditError('');
    try {
      const updatedUser = await updateProfile(user.id, { name: editName, username: editUsername, avatar: editAvatar });
      setUser(updatedUser);
      setShowProfileModal(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartPasswordChange = async () => {
    setPasswordMode('sending');
    setPasswordError('');
    try {
      const res = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      if (!res.ok) throw new Error('Failed to send verification code');
      setPasswordMode('code');
    } catch (err) {
      setPasswordError(err.message);
      setPasswordMode('idle');
    }
  };

  const handleVerifyPasswordCode = async () => {
    setPasswordError('');
    if (!verificationCode) return;
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: verificationCode })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid code');
      }
      setPasswordMode('new_password');
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handleSaveNewPassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    try {
      await updatePassword(user.id, newPassword);
      setPasswordMode('success');
      setTimeout(() => {
        setPasswordMode('idle');
        setVerificationCode('');
        setNewPassword('');
      }, 3000);
    } catch (err) {
      setPasswordError('Failed to update password');
    }
  };

  const handleProtectedView = (targetView) => {
    if (!user) {
      setView('auth');
    } else {
      setView(targetView);
      if (targetView === 'favorites') setUnreadLikesCount(0);
      if (targetView === 'watched') setUnreadSeenCount(0);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setUser(null);
    setView('home');
  };

  const advanceCard = () => {
    if (currentIndex < recommendations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setView('home');
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col p-4 transition-all duration-700 theme-${theme}`}
      style={{ backgroundColor: 'var(--bg-color)' }}
    >
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen animate-pulse"
          style={{ backgroundColor: 'var(--bg-glow)' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000"
          style={{ backgroundColor: 'var(--bg-glow)' }}
        />
      </div>

      {/* Navigation / Header */}
      <nav className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-40">
        <div
          onClick={() => setView('home')}
          className="flex items-center gap-2 cursor-pointer group relative z-10"
        >
          <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <Sparkles size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold font-outfit tracking-tight">WatchDecider</span>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() => handleProtectedView('favorites')}
            className="p-2 glass rounded-xl relative group active:scale-95 transition-all"
            title="Collection"
          >
            <Star size={20} className={`${view === 'favorites' ? 'text-yellow-400' : 'text-slate-400'} group-hover:text-yellow-400 transition-colors`} />
            {unreadLikesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-yellow-500 text-[10px] px-1 flex items-center justify-center rounded-full text-black font-bold">
                {unreadLikesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleProtectedView('watched')}
            className="p-2 glass rounded-xl relative group active:scale-95 transition-all"
            title="Watched"
          >
            <Check size={20} className={`${view === 'watched' ? 'text-indigo-400' : 'text-slate-400'} group-hover:text-indigo-400 transition-colors`} />
            {unreadSeenCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-indigo-500 text-[10px] px-1 flex items-center justify-center rounded-full text-white font-bold">
                {unreadSeenCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="px-4 py-2 glass rounded-2xl flex items-center gap-3 hover:border-white/20 transition-all active:scale-95 ml-2 group"
            >
              <div className="w-7 h-7 premium-gradient rounded-full flex items-center justify-center overflow-hidden group-hover:rotate-12 transition-transform">
                {user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover bg-white/20" alt="Profile" />
                ) : (
                  <UserIcon size={14} className="text-white" />
                )}
              </div>
              <span className="hidden sm:inline text-xs font-bold font-outfit">
                {user ? (user.name || user.username) : 'Account'}
              </span>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 p-2"
                  >
                    {!user ? (
                      <button
                        onClick={() => {
                          setView('auth');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                      >
                        <LogIn size={18} className="text-indigo-400" />
                        Sign In / Join
                      </button>
                    ) : (
                      <>
                        <div className="px-4 py-3 mb-2 border-b border-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Signed in as</p>
                          <p className="text-sm font-bold truncate">{user.username}</p>
                        </div>
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setEditError('');
                            setEditName(user.name || '');
                            setEditUsername(user.username || '');
                            setEditAvatar(user.avatar || '');
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                        >
                          <UserIcon size={18} className="text-indigo-400" />
                          Edit Profile
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setShowFilters(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                    >
                      <Settings size={18} className="text-indigo-400" />
                      Filters
                    </button>

                    <button
                      onClick={() => {
                        setShowThemeModal(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                    >
                      <Sparkles size={18} className="text-purple-400" />
                      Themes
                    </button>

                    {user && (
                      <>
                        <div className="h-px bg-white/5 my-1" />
                        <button
                          onClick={() => {
                            handleLogout();
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <LogOut size={18} />
                          Sign Out
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <main className={`w-full ${view === 'favorites' ? 'max-w-4xl' : 'max-w-md'} mx-auto flex flex-col items-center justify-center min-h-screen pt-24 pb-20`}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center flex flex-col items-center gap-8"
            >
              <div className="space-y-4">
                <h1 className="text-5xl sm:text-6xl font-black font-outfit leading-tight tracking-tighter">
                  Stop scrolling. <br />
                  <span className="text-gradient">Start watching.</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-xs mx-auto">
                  Tired of decision fatigue? We'll pick 3 perfect options in under 10 seconds.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={handleDecide}
                  className="btn-primary"
                >
                  <Play size={20} fill="currentColor" />
                  Decide for Me
                </button>
              </div>

              {/* Recent Activity Previews */}
              {user && (likedItems.length > 0 || seenItems.length > 0) && (
                <div className="w-full space-y-8 mt-4 pt-8 border-t border-white/5">
                  {likedItems.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h3 className="text-lg font-bold font-outfit">Your Collection</h3>
                        <button
                          onClick={() => handleProtectedView('favorites')}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                        >
                          See All
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {likedItems.slice(-4).reverse().map(item => (
                          <div key={item.id} className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 shadow-lg">
                            <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {seenItems.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h3 className="text-lg font-bold font-outfit">Watch History</h3>
                        <button
                          onClick={() => handleProtectedView('watched')}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                        >
                          See All
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {seenItems.slice(-4).reverse().map(item => (
                          <div key={item.id} className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-white/5 shadow-lg grayscale hover:grayscale-0 transition-all duration-300">
                            <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[8px] text-white font-bold leading-tight line-clamp-2">{item.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative w-24 h-24">
                <motion.div
                  className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 border-t-4 border-indigo-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold font-outfit mb-1">Deciding for you...</h3>
                <p className="text-slate-400 animate-pulse">Filtering 800,000+ titles</p>
              </div>
            </motion.div>
          )}

          {view === 'cards' && recommendations.length > 0 && (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-[650px] flex items-center justify-center pt-10"
            >
              <div className="absolute top-2 left-0 right-0 flex justify-between items-center px-4 z-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                <span>{currentIndex + 1} of {recommendations.length}</span>
                <button
                  onClick={() => setView('home')}
                  className="px-4 py-2 bg-slate-900 border border-white/10 rounded-full hover:bg-slate-800 transition-all text-white flex items-center gap-2 pointer-events-auto"
                >
                  <X size={14} /> Cancel
                </button>
              </div>

              <div className="relative w-full h-full flex items-center justify-center">
                <Suspense fallback={<div className="absolute inset-0 w-full h-[540px] sm:h-[650px] rounded-[2.5rem] glass animate-pulse border border-white/10" />}>
                  {recommendations.slice(currentIndex, currentIndex + 1).map((item) => {
                    return (
                      <RecommendationCard
                        key={item.id}
                        item={item}
                        index={0}
                        isTop={true}
                        onLike={handleLike}
                        onDislike={handleDislike}
                      />
                    )
                  })}
                </Suspense>
              </div>
            </motion.div>
          )}

          {view === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col gap-10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-black font-outfit">Collection</h2>
                  <p className="text-slate-400">Manage your watch lists</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-1 glass rounded-2xl flex gap-1">
                    <button 
                      onClick={() => setFavoritesTab('likes')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${favoritesTab === 'likes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      Liked
                    </button>
                    <button 
                      onClick={() => setFavoritesTab('tracking')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${favoritesTab === 'tracking' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      Tracking
                    </button>
                  </div>
                  <button
                    onClick={handleResetCollection}
                    className="p-3 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all"
                    title="Reset Everything"
                  >
                    <RefreshCcw size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-12">
                {favoritesTab === 'likes' ? (
                  <>
                    {['movie', 'tv', 'anime'].map(type => {
                      const items = likedItems.filter(i => i.type === type);
                      if (items.length === 0) return null;

                      return (
                        <section key={type} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center gap-4 mb-6">
                            <h3 className="text-xl font-bold font-outfit capitalize">
                              {type === 'tv' ? 'TV Shows' : type === 'anime' ? 'Anime Series' : 'Movies'}
                            </h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent" />
                            <span className="text-xs font-bold text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-lg">
                              {items.length} titles
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {items.map(item => (
                              <div key={item.id} className="group relative aspect-[2/3] rounded-2xl overflow-hidden glass border border-white/5 shadow-xl">
                                <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                  <p className="text-white font-bold text-sm leading-tight mb-1">{item.title}</p>
                                  <p className="text-slate-400 text-[10px] uppercase tracking-tighter mb-3">
                                    {item.releaseDate?.split('-')[0]} • {item.rating.toFixed(1)} Rating
                                  </p>
                                  
                                  <div className={`grid gap-2 ${item.type === 'movie' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    <button
                                      onClick={() => handleMarkAsSeen(item)}
                                      className="py-2 text-[10px] bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors uppercase w-full"
                                    >
                                      Seen it
                                    </button>
                                    {(item.type === 'tv' || item.type === 'anime') && (
                                      <button
                                        onClick={() => handleToggleTracking(item)}
                                        className={`py-2 text-[10px] rounded-lg font-bold transition-colors uppercase w-full ${trackingItems.find(i => i.id === item.id) ? 'bg-indigo-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'}`}
                                      >
                                        {trackingItems.find(i => i.id === item.id) ? 'Tracking' : 'Track'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const newLikes = likedItems.filter(i => i.id !== item.id);
                                    setLikedItems(newLikes);
                                    syncUserData(newLikes, null, null);
                                  }}
                                  className="absolute top-2 right-2 p-2 bg-red-500/90 text-white rounded-xl scale-0 group-hover:scale-100 transition-all hover:bg-red-600 shadow-lg"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </>
                ) : (
                  <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 gap-6">
                      {trackingItems.length > 0 ? trackingItems.map(item => {
                        const totalEps = item.seasons?.reduce((acc, s) => acc + (s.episodeCount || 0), 0) || 1;
                        const watchedEps = (item.seasons?.filter(s => s.seasonNumber < item.season).reduce((acc, s) => acc + (s.episodeCount || 0), 0) || 0) + Math.max(0, (parseInt(item.episode, 10) || 1) - 1);
                        const progressPercent = Math.min(100, Math.max(0, (watchedEps / totalEps) * 100));

                        return (
                        <div key={item.id} className="relative bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col sm:flex-row gap-6 border border-white/5 hover:border-indigo-500/30 transition-all group shadow-2xl overflow-hidden">
                          {/* Ambient glow from poster */}
                          <div className="absolute -inset-10 bg-indigo-500/10 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          
                          <div className="relative w-28 h-40 rounded-2xl overflow-hidden shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10 group-hover:scale-105 transition-transform duration-500">
                            <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-between relative z-10 py-1">
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                  <h4 className="font-outfit font-black text-white text-xl leading-tight mb-1">{item.title}</h4>
                                  <p className="text-[10px] text-indigo-300 uppercase tracking-[0.2em] font-bold">
                                    {item.type === 'anime' ? 'Anime Series' : 'TV Show'}
                                  </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                 {unsavedTracking[item.id] && (
                                   <button 
                                     onClick={() => handleSaveTracking(item.id)}
                                     className="w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-xl hover:bg-green-400 transition-all shadow-lg hover:shadow-green-500/25 hover:-translate-y-1"
                                     title="Save Changes"
                                   >
                                      <Save size={18} />
                                   </button>
                                 )}
                                 <button 
                                   onClick={() => handleMarkAsSeen(item)}
                                   className="w-10 h-10 flex items-center justify-center bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:-translate-y-1"
                                   title="Completed"
                                 >
                                    <Check size={18} />
                                 </button>
                                 <button 
                                   onClick={() => handleToggleTracking(item)}
                                   className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500/80 hover:bg-red-500 hover:text-white rounded-xl transition-all hover:-translate-y-1"
                                   title="Stop Tracking"
                                 >
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                            </div>
                            
                            <div className="mt-6">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-black/20 p-3 rounded-2xl border border-white/5 shadow-inner">
                                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-3 flex justify-between items-center">
                                  <span>Season</span>
                                  <span className="text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{item.season}/{item.totalSeasons || '?'}</span>
                                </p>
                                <div className="flex items-center justify-between bg-slate-900/80 rounded-xl overflow-hidden border border-white/5">
                                  <button 
                                    onClick={() => handleUpdateTracking(item.id, 'season', -1)}
                                    className="w-10 py-2 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                  >-</button>
                                  <input 
                                    type="number"
                                    value={item.season || ''}
                                    onChange={(e) => handleSetTracking(item.id, 'season', e.target.value)}
                                    className="flex-1 w-full bg-transparent text-center font-mono font-black text-white text-base outline-none focus:text-indigo-400 transition-colors appearance-none"
                                  />
                                  <button 
                                    onClick={() => handleUpdateTracking(item.id, 'season', 1)}
                                    className="w-10 py-2 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                  >+</button>
                                </div>
                              </div>

                              <div className="bg-black/20 p-3 rounded-2xl border border-white/5 shadow-inner">
                                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-3 flex justify-between items-center">
                                  <span>Episode</span>
                                  <span className="text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{item.episode}/{item.seasons?.find(s => s.seasonNumber === item.season)?.episodeCount || '?'}</span>
                                </p>
                                <div className="flex items-center justify-between bg-slate-900/80 rounded-xl overflow-hidden border border-white/5">
                                  <button 
                                    onClick={() => handleUpdateTracking(item.id, 'episode', -1)}
                                    className="w-10 py-2 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                  >-</button>
                                  <input 
                                    type="number"
                                    value={item.episode || ''}
                                    onChange={(e) => handleSetTracking(item.id, 'episode', e.target.value)}
                                    className="flex-1 w-full bg-transparent text-center font-mono font-black text-white text-base outline-none focus:text-indigo-400 transition-colors appearance-none"
                                  />
                                  <button 
                                    onClick={() => handleUpdateTracking(item.id, 'episode', 1)}
                                    className="w-10 py-2 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                  >+</button>
                                </div>
                              </div>
                              </div>
                              
                              <div className="w-full bg-black/40 rounded-full h-1.5 mb-1 overflow-hidden shadow-inner">
                                <div 
                                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500" 
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                              <p className="text-[9px] text-right text-indigo-300 font-bold uppercase tracking-widest">{Math.round(progressPercent)}% Completed</p>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                        <div className="col-span-full text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
                          <Play size={48} className="text-slate-800" />
                          <div className="space-y-1">
                            <p className="text-slate-300 font-bold">Nothing being tracked</p>
                            <p className="text-slate-500 text-sm">Add TV shows or Anime from your liked list to track your progress.</p>
                          </div>
                          <button 
                            onClick={() => setFavoritesTab('likes')}
                            className="mt-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                          >
                            Go to Liked items →
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {likedItems.length === 0 && (
                  <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
                    <Star size={48} className="text-slate-800" />
                    <div className="space-y-1">
                      <p className="text-slate-300 font-bold">Your collection is empty</p>
                      <p className="text-slate-500 text-sm">Start liking recommendations to see them here.</p>
                    </div>
                    <button
                      onClick={() => setView('home')}
                      className="mt-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                    >
                      Find something to watch →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'watched' && (
            <motion.div
              key="watched"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col gap-10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-black font-outfit text-indigo-400">Watched History</h2>
                  <p className="text-slate-400">Titles you've seen or skipped</p>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="w-fit flex items-center gap-2 px-6 py-3 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white font-bold rounded-2xl transition-all"
                >
                  <RefreshCcw size={18} /> Clear All History
                </button>
              </div>

              <div className="space-y-12">
                {['movie', 'tv', 'anime'].map(type => {
                  const items = seenItems.filter(i => i.type === type);
                  if (items.length === 0) return null;

                  return (
                    <section key={type}>
                      <div className="flex items-center gap-4 mb-6">
                        <h3 className="text-xl font-bold font-outfit capitalize">
                          Watched {type === 'tv' ? 'TV' : type === 'anime' ? 'Anime' : 'Movies'}
                        </h3>
                        <div className="h-px flex-1 bg-slate-800" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{items.length} seen</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(item => (
                          <div key={item.id} className="group relative aspect-[2/3] rounded-xl overflow-hidden glass border border-white/5 grayscale hover:grayscale-0 transition-all duration-500 shadow-lg">
                            <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />

                            {/* Content Overlay on Hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                              <p className="text-white font-bold text-xs leading-tight mb-0.5">{item.title}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-[9px] uppercase tracking-tighter">
                                  {item.releaseDate?.split('-')[0]}
                                </span>
                                <span className="text-yellow-500 font-bold text-[9px] flex items-center gap-0.5">
                                  <Star size={8} fill="currentColor" /> {item.rating?.toFixed(1)}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const newSeen = seenItems.filter(i => i.id !== item.id);
                                setSeenItems(newSeen);
                                syncUserData(null, null, newSeen);
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 hover:bg-red-600 shadow-xl z-10"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}

                {seenItems.length === 0 && (
                  <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                    <Check size={40} className="text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500">Your watch history is empty.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'auth' && (
            <Suspense fallback={<div className="flex justify-center p-20"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <AuthView
                onAuthSuccess={(session) => {
                  setUser(session);
                  setView('home');
                }}
                onCancel={() => setView('home')}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Info */}
      <footer className="relative mt-auto pt-16 pb-8 text-slate-600 text-[10px] tracking-widest uppercase text-center w-full">
        Powered by TMDB API • decider v1.0
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showFilters && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <FilterModal
              filters={filters}
              setFilters={setFilters}
              onClose={() => setShowFilters(false)}
            />
          </Suspense>
        )}

        {showThemeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass border border-white/10 rounded-3xl p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold font-outfit">Select Theme</h2>
                <button onClick={() => setShowThemeModal(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'midnight', name: 'Midnight', color: 'bg-indigo-600' },
                  { id: 'emerald', name: 'Emerald', color: 'bg-emerald-600' },
                  { id: 'rose', name: 'Rose', color: 'bg-rose-600' },
                  { id: 'ocean', name: 'Ocean', color: 'bg-sky-600' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemeModal(false);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${theme === t.id ? 'border-white bg-white/10' : 'border-white/5 hover:border-white/20'}`}
                  >
                    <div className={`w-10 h-10 ${t.color} rounded-full shadow-lg`} />
                    <span className="text-xs font-bold uppercase tracking-widest">{t.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showProfileModal && user && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass border border-white/10 rounded-3xl p-8"
              onFocus={() => {
                // Initialize edit fields
                if (!editName) {
                  setEditName(user.name || '');
                  setEditAvatar(user.avatar || AVATAR_OPTIONS[0]);
                  setPasswordMode('idle');
                  setVerificationCode('');
                  setNewPassword('');
                  setPasswordError('');
                }
              }}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold font-outfit">Edit Profile</h2>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setEditName('');
                    setEditUsername('');
                    setEditAvatar('');
                    setEditError('');
                    setPasswordMode('idle');
                  }}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-indigo-500/50 outline-none"
                  />
                </div>



                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="decider_fan"
                    required
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-indigo-500/50 outline-none"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-sm font-bold text-white">Security</h3>
                  {passwordMode === 'idle' && (
                    <button
                      type="button"
                      onClick={handleStartPasswordChange}
                      className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-white rounded-xl transition-all text-sm font-medium"
                    >
                      Change Password
                    </button>
                  )}
                  {passwordMode === 'sending' && (
                    <div className="text-sm text-slate-400 animate-pulse">Sending verification code to your email...</div>
                  )}
                  {passwordMode === 'code' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Verification Code</label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                        placeholder="6-digit code"
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-indigo-500/50 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPasswordCode}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        Verify Code
                      </button>

                    </div>
                  )}
                  {passwordMode === 'new_password' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-indigo-500/50 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNewPassword}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        Save New Password
                      </button>

                    </div>
                  )}
                  {passwordMode === 'success' && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 rounded-xl text-center">
                      Password updated successfully!
                    </div>
                  )}
                </div>
                <div className="space-y-3 mt-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Profile Picture</label>
                  <div className="flex gap-2 justify-between">
                    {AVATAR_OPTIONS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEditAvatar(url)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all p-0 focus:outline-none ${editAvatar === url ? 'border-indigo-500 scale-110' : 'border-transparent hover:border-indigo-500/50'}`}
                      >
                        <img src={url} alt={`Avatar option ${i + 1}`} className="w-full h-full object-cover bg-slate-800" />
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {(editError || passwordError) && (
                    <motion.div 
                      key="profile-edit-error"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 mt-6"
                    >
                      <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm font-medium leading-relaxed">
                        {editError || passwordError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3 mt-8">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 py-4 premium-gradient text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm glass border border-red-500/20 rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} className="text-red-500" />
              </div>

              <h2 className="text-2xl font-bold font-outfit text-center mb-2">{confirmModal.title}</h2>
              <p className="text-slate-400 text-center text-sm leading-relaxed mb-8">
                {confirmModal.message}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmModal.onConfirm}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-900/20 active:scale-[0.98]"
                >
                  Confirm & Delete
                </button>
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                  className="w-full py-4 bg-slate-900 text-slate-400 font-bold rounded-2xl hover:text-white transition-colors border border-slate-800"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
