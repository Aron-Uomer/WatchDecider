import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Star, Info, ThumbsUp, ThumbsDown, X } from 'lucide-react';

const RecommendationCard = ({ 
  item, 
  onLike, 
  onDislike, 
  index, 
  isTop 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const dislikeOpacity = useTransform(x, [-50, -150], [0, 1]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      onLike(item);
    } else if (info.offset.x < -100) {
      onDislike(item);
    }
  };

  return (
    <motion.div
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      animate={{ scale: 1 - index * 0.05, y: index * 20 }}
      whileHover={{ scale: isTop ? 1.02 : 1 }}
      className={`absolute inset-0 w-full h-[540px] sm:h-[650px] rounded-[2.5rem] overflow-hidden glass shadow-2xl flex flex-col cursor-grab active:cursor-grabbing border border-white/10`}
    >
      {/* Full-bleed Poster Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={item.poster} 
          alt={item.title} 
          className="w-full h-full object-cover"
        />
        {/* Deep Multi-stage Gradient for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-transparent" />
      </div>
      
      {/* Swipe Indicators */}
      {isTop && (
        <div className="relative z-30">
          <motion.div 
            style={{ opacity: likeOpacity }} 
            className="absolute top-10 right-10 px-6 py-3 border-4 border-green-500 rounded-2xl transform rotate-12 text-green-500 font-black text-3xl shadow-lg bg-black/20 backdrop-blur-sm"
          >
            LIKE
          </motion.div>
          <motion.div 
            style={{ opacity: dislikeOpacity }} 
            className="absolute top-10 left-10 px-6 py-3 border-4 border-red-500 rounded-2xl transform -rotate-12 text-red-500 font-black text-3xl shadow-lg bg-black/20 backdrop-blur-sm"
          >
            NOPE
          </motion.div>
        </div>
      )}

      {/* Top Badge Overlay */}
      <div className="relative z-20 p-6 flex justify-between items-start">
        <div className="px-3 py-1.5 glass-dark rounded-xl flex items-center gap-1.5 shadow-lg border border-white/10">
          <Star size={16} className="text-yellow-400" fill="currentColor" /> 
          <span className="font-bold text-sm text-white">{item.rating.toFixed(1)}</span>
        </div>
        <div className="px-3 py-1.5 glass-dark rounded-xl text-white/80 text-xs font-bold font-outfit uppercase tracking-widest border border-white/5">
          {item.releaseDate?.split('-')[0]}
        </div>
      </div>

      {/* Full description overlay (Modern Center-Focus) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="absolute inset-0 bg-slate-950/60 p-8 overflow-y-auto flex flex-col justify-center items-center text-center z-40 transition-all"
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              className="absolute top-6 right-6 p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-all text-white border border-white/10"
            >
              <X size={20} />
            </button>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
              Plot Overview
            </h4>
            <p className="text-white text-lg leading-relaxed font-medium font-outfit italic">
              "{item.description}"
            </p>
            <div className="mt-8 flex flex-col items-center gap-2">
               <div className="w-12 h-1 bg-white/20 rounded-full" />
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Tap to hide</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Content Area */}
      <div className="mt-auto p-8 pt-20 relative z-20 flex flex-col gap-4">
        <div>
          <h3 className="text-4xl font-black font-outfit text-white tracking-tight leading-tight mb-2 drop-shadow-2xl">
            {item.title}
          </h3>
          <p className={`text-base text-slate-200 leading-snug line-clamp-2 mix-blend-plus-lighter`}>
            {item.description}
          </p>
          
          {!isExpanded && item.description?.length > 80 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              className="mt-3 text-xs font-black text-indigo-300 hover:text-white flex items-center gap-1.5 uppercase tracking-widest transition-all group"
            >
              Learn More <Info size={14} className="group-hover:rotate-12 transition-transform" />
            </button>
          )}
        </div>
        
        {/* Match Reason (Compact Card) */}
        <div className="px-5 py-3.5 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl flex items-start gap-3 shadow-inner">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <ThumbsUp size={16} className="text-indigo-400" />
          </div>
          <p className="text-xs text-indigo-100/90 leading-relaxed font-medium italic pr-2">
            {item.reason}
          </p>
        </div>

        {/* Action Buttons (Premium Float) */}
        <div className="flex items-center justify-between gap-4 mt-2">
           <button 
             onClick={() => onDislike(item)}
             className="w-full py-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/40 backdrop-blur-md transition-all active:scale-95 group shadow-lg"
           >
             <X size={24} className="group-hover:rotate-90 transition-transform" />
           </button>
           <button 
             onClick={() => onLike(item)}
             className="w-full py-4 flex items-center justify-center gap-3 rounded-2xl premium-gradient text-white font-bold border border-white/20 transition-all shadow-xl shadow-indigo-900/40 active:scale-95 group"
           >
             <ThumbsUp size={24} className="group-hover:-translate-y-1 transition-transform" />
             <span className="hidden sm:inline uppercase tracking-widest text-xs font-black">Hold to Like</span>
           </button>
        </div>
      </div>
    </motion.div>
  );
};

export default RecommendationCard;
