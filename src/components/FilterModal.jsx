import React, { useState } from 'react';
import { GENRES } from '../services/tmdb';
import { X, CheckCircle2, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';

const FilterModal = ({ filters: initialFilters, setFilters, onClose }) => {
  const [localFilters, setLocalFilters] = useState({ ...initialFilters });

  const toggleGenre = (id) => {
    if (localFilters.genres.includes(id)) {
      setLocalFilters({ ...localFilters, genres: localFilters.genres.filter(g => g !== id) });
    } else {
      setLocalFilters({ ...localFilters, genres: [...localFilters.genres, id] });
    }
  };

  const handleApply = () => {
    setFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({
      type: 'movie',
      genres: [],
      mood: null,
      yearRange: [1980, 2026],
      minRating: 6.5,
      useRatingFilter: false,
      useYearFilter: false
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl h-[80vh] overflow-y-auto glass rounded-3xl p-8 shadow-2xl border-indigo-500/10"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
             <Wand2 className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold font-outfit">Refine Your Decider</h2>
        </div>

        <div className="space-y-10">
          {/* Type Selection */}
          <section>
            <h3 className="text-lg font-semibold mb-3 text-slate-300">Content Type</h3>
            <div className="flex flex-wrap gap-3">
              {['movie', 'tv', 'anime'].map(t => (
                <button
                  key={t}
                  onClick={() => setLocalFilters({ ...localFilters, type: t, genres: [] })}
                  className={`flex-1 min-w-[100px] py-3 rounded-2xl border transition-all font-medium capitalize 
                    ${localFilters.type === t 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                      : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                  {t === 'tv' ? 'TV Series' : t}
                </button>
              ))}
            </div>
          </section>

          {/* Year Range */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-slate-300">Release Year</h3>
              <button 
                onClick={() => setLocalFilters({ ...localFilters, useYearFilter: !localFilters.useYearFilter })}
                className={`w-10 h-5 rounded-full transition-all relative ${localFilters.useYearFilter ? 'bg-indigo-500' : 'bg-slate-800'}`}
              >
                 <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${localFilters.useYearFilter ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            
            <div className={`grid grid-cols-2 gap-8 px-2 transition-opacity ${localFilters.useYearFilter ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              {/* Start Year */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">From</label>
                  <input 
                    type="number"
                    min="1900"
                    disabled={!localFilters.useYearFilter}
                    max={localFilters.yearRange[1]}
                    value={localFilters.yearRange[0]}
                    onChange={(e) => setLocalFilters({ ...localFilters, yearRange: [parseInt(e.target.value), localFilters.yearRange[1]] })}
                    className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-xs font-mono text-indigo-400"
                  />
                </div>
                <input 
                  type="range"
                  min="1900"
                  max="2026"
                  disabled={!localFilters.useYearFilter}
                  value={localFilters.yearRange[0]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLocalFilters({ ...localFilters, yearRange: [Math.min(val, localFilters.yearRange[1]), localFilters.yearRange[1]] });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* End Year */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">To</label>
                  <input 
                    type="number"
                    min={localFilters.yearRange[0]}
                    max="2026"
                    disabled={!localFilters.useYearFilter}
                    value={localFilters.yearRange[1]}
                    onChange={(e) => setLocalFilters({ ...localFilters, yearRange: [localFilters.yearRange[0], parseInt(e.target.value)] })}
                    className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-xs font-mono text-indigo-400"
                  />
                </div>
                <input 
                  type="range"
                  min="1900"
                  max="2026"
                  disabled={!localFilters.useYearFilter}
                  value={localFilters.yearRange[1]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLocalFilters({ ...localFilters, yearRange: [localFilters.yearRange[0], Math.max(val, localFilters.yearRange[0])] });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
            <div className={`flex justify-between mt-4 px-2 transition-opacity ${localFilters.useYearFilter ? 'opacity-100' : 'opacity-20'}`}>
               <span className="text-[9px] text-slate-600 uppercase tracking-[0.2em] font-black">1900</span>
               <span className="text-[9px] text-slate-600 uppercase tracking-[0.2em] font-black">Today</span>
            </div>
          </section>

          {/* Rating Filter */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-300">Minimum Rating</h3>
                <button 
                  onClick={() => setLocalFilters({ ...localFilters, useRatingFilter: !localFilters.useRatingFilter })}
                  className={`w-10 h-5 rounded-full transition-all relative ${localFilters.useRatingFilter ? 'bg-yellow-500' : 'bg-slate-800'}`}
                >
                   <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${localFilters.useRatingFilter ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {localFilters.useRatingFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 font-bold font-mono px-3 py-1 bg-yellow-500/10 rounded-lg text-lg">
                    {localFilters.minRating || 0}
                  </span>
                  <span className="text-slate-500 text-xs">/ 10</span>
                </div>
              )}
            </div>
            <div className={`px-2 transition-opacity ${localFilters.useRatingFilter ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <input 
                 type="range"
                 min="0"
                 max="9"
                 step="0.5"
                 disabled={!localFilters.useRatingFilter}
                 value={localFilters.minRating || 0}
                 onChange={(e) => setLocalFilters({ ...localFilters, minRating: parseFloat(e.target.value) })}
                 className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between mt-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                 <span>Any Rating</span>
                 <span>Masterpieces (9.0+)</span>
               </div>
            </div>
          </section>

          {/* Genre Selection */}
          <section>
            <h3 className="text-lg font-semibold mb-3 text-slate-300">Popular Genres</h3>
            <div className="flex flex-wrap gap-2">
              {((localFilters.type === 'movie' ? GENRES.MOVIE : localFilters.type === 'tv' ? GENRES.TV : GENRES.ANIME) || []).slice(0, 16).map(genre => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-4 py-2 rounded-full border text-sm transition-all flex items-center gap-2 
                    ${localFilters.genres.includes(genre.id)
                      ? 'bg-primary-600/20 border-primary-500 text-primary-300'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  {localFilters.genres.includes(genre.id) && <CheckCircle2 size={14} className="text-primary-400" />}
                  {genre.name}
                </button>
              ))}
            </div>
          </section>

          {/* Reset & Apply & Cancel */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
             <button 
               onClick={handleReset}
               className="px-6 py-4 rounded-2xl bg-slate-900 text-slate-400 font-bold hover:text-slate-200 transition-colors border border-slate-800"
             >
               Reset
             </button>
             <button 
               onClick={onClose}
               className="px-6 py-4 rounded-2xl bg-slate-900 text-slate-400 font-bold hover:text-slate-200 transition-colors border border-slate-800"
             >
               Cancel
             </button>
             <button 
               onClick={handleApply}
               className="flex-1 py-4 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-500 transition-all shadow-lg shadow-primary-900/20"
             >
               Apply Filters
             </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FilterModal;
