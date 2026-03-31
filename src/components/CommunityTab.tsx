import React, { useState, useEffect } from "react";
import { MessageSquare, Heart, Share2, Plus, Send, MoreHorizontal, UserPlus, TrendingUp, Search, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, limit } from "firebase/firestore";
import { toast } from "sonner";

interface CommunityTabProps {
  user: any;
}

const formatDateTime = (date: string | number | Date) => {
  const past = new Date(date);
  return past.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

const CommunityTab: React.FC<CommunityTabProps> = ({ user }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribePosts = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "posts");
    });
    
    return () => unsubscribePosts();
  }, []);

  useEffect(() => {
    if (!user || posts.length === 0) return;
    
    const unsubscribes: (() => void)[] = [];
    
    posts.forEach(post => {
      const likeRef = doc(db, "posts", post.id, "likes", user.uid);
      const unsub = onSnapshot(likeRef, (likeDoc) => {
        setUserLikes(prev => ({ ...prev, [post.id]: likeDoc.exists() }));
      });
      unsubscribes.push(unsub);
    });
    
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, posts.map(p => p.id).join(",")]);

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
    setLoading(true);
    const path = "posts";
    try {
      await addDoc(collection(db, path), {
        authorUid: user.uid,
        authorName: user.displayName || "Quantum Trader",
        authorAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        content: newPost,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });
      setNewPost("");
      toast.success("Post shared with the community!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    
    // Optimistic update
    const isLiked = userLikes[postId];
    setUserLikes(prev => ({ ...prev, [postId]: !isLiked }));
    
    try {
      const response = await fetch("/api/community/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, uid: user.uid })
      });
      if (!response.ok) {
        // Revert on failure
        setUserLikes(prev => ({ ...prev, [postId]: isLiked }));
        throw new Error("Failed to like post");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleComment = async (postId: string) => {
    if (!commentText.trim() || !user) return;
    setLoading(true);
    try {
      const response = await fetch("/api/community/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          uid: user.uid,
          authorName: user.displayName || "Quantum Trader",
          authorAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          content: commentText
        })
      });
      if (!response.ok) throw new Error("Failed to post comment");
      setCommentText("");
      setCommentingOn(null);
      toast.success("Comment added!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
      {/* Feed Section */}
      <div className="lg:col-span-2 space-y-4 md:space-y-6">
        {/* Create Post */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl">
          <div className="flex gap-3 md:gap-4 mb-4">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
              alt="Avatar"
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 shrink-0"
              referrerPolicy="no-referrer"
            />
            <textarea
              placeholder="Share your trading insights..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 focus:outline-none focus:border-orange-500 transition-all resize-none h-20 md:h-24 text-xs md:text-sm"
            />
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-3 md:pt-4">
            <div className="flex gap-1 md:gap-2">
              <button className="text-white/40 hover:text-orange-500 transition-colors p-2 rounded-lg hover:bg-white/5 shrink-0">
                <TrendingUp size={18} className="md:w-5 md:h-5" />
              </button>
              <button className="text-white/40 hover:text-orange-500 transition-colors p-2 rounded-lg hover:bg-white/5 shrink-0">
                <Plus size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
            <button
              onClick={handleCreatePost}
              disabled={loading || !newPost.trim()}
              className="bg-orange-500 text-black font-bold px-4 md:px-6 py-2 rounded-lg md:rounded-xl flex items-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50 text-sm md:text-base"
            >
              <Send size={16} className="md:w-[18px] md:h-[18px]" />
              <span>Post</span>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4 md:space-y-6">
          <AnimatePresence>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-base md:text-lg hover:text-orange-500 cursor-pointer transition-colors truncate">
                        {post.authorName}
                      </p>
                      <p className="text-[10px] md:text-xs text-white/40 truncate">
                        {formatDateTime(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button className="text-white/20 hover:text-white transition-colors shrink-0">
                    <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                  </button>
                </div>
                <p className="text-white/80 leading-relaxed mb-4 md:mb-6 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>
                
                <div className="flex items-center gap-4 md:gap-6 border-t border-white/5 pt-4 md:pt-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-2 transition-colors group/btn shrink-0 ${
                      userLikes[post.id] ? "text-red-500" : "text-white/40 hover:text-red-400"
                    }`}
                  >
                    <Heart 
                      size={18} 
                      className={`md:w-5 md:h-5 ${userLikes[post.id] ? "fill-red-500" : "group-hover/btn:fill-red-400"}`} 
                    />
                    <span className="text-xs md:text-sm font-bold">{post.likesCount || 0}</span>
                  </button>
                  <button 
                    onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                    className="flex items-center gap-2 text-white/40 hover:text-blue-400 transition-colors group/btn shrink-0"
                  >
                    <MessageSquare size={18} className="md:w-5 md:h-5 group-hover/btn:fill-blue-400" />
                    <span className="text-xs md:text-sm font-bold">{post.commentsCount || 0}</span>
                  </button>
                  <button 
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1 text-white/20 hover:text-white transition-colors text-[10px] md:text-xs"
                  >
                    {expandedComments[post.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{expandedComments[post.id] ? "Hide Comments" : "View Comments"}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-green-400 transition-colors group/btn ml-auto shrink-0">
                    <Share2 size={18} className="md:w-5 md:h-5" />
                  </button>
                </div>

                {/* Comment Input */}
                {commentingOn === post.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-white/5"
                  >
                    <div className="flex gap-3">
                      <img
                        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full bg-white/5 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-all text-xs md:text-sm"
                        />
                        <button
                          onClick={() => handleComment(post.id)}
                          disabled={!commentText.trim() || loading}
                          className="bg-orange-500 text-black p-2 rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Comments List */}
                {expandedComments[post.id] && (
                  <CommentsList postId={post.id} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sidebar Section (Visible on LG, below on MD) */}
      <div className="hidden lg:block space-y-6 md:space-y-8">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Search community..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-all"
          />
        </div>

        {/* Trending Topics */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-orange-500" />
            <span>Trending Topics</span>
          </h3>
          <div className="space-y-4">
            {["#SuiMainnet", "#USDTBridge", "#QuantumAlpha", "#BTC60K", "#zkLogin"].map((tag) => (
              <div key={tag} className="group cursor-pointer">
                <p className="font-bold text-sm group-hover:text-orange-500 transition-colors">{tag}</p>
                <p className="text-xs text-white/40">1.2k posts today</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Traders */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-6">Suggested Traders</h3>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=trader${i}`}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full bg-white/5"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="font-bold text-sm">AlphaTrader_{i}</p>
                    <p className="text-xs text-white/40">Top 1% Profit</p>
                  </div>
                </div>
                <button className="text-white/40 hover:text-orange-500 transition-colors p-2 rounded-lg hover:bg-white/5">
                  <UserPlus size={20} />
                </button>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 text-orange-500 text-sm font-bold hover:underline">View All</button>
        </div>
      </div>
    </div>
  );
};

const CommentsList: React.FC<{ postId: string }> = ({ postId }) => {
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [postId]);

  if (comments.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 pl-4 border-l border-white/5">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2 items-start">
          <img
            src={comment.authorAvatar}
            alt={comment.authorName}
            className="w-6 h-6 rounded-full bg-white/5 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="bg-white/5 rounded-xl p-2 flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-orange-500">{comment.authorName}</span>
              <span className="text-[8px] text-white/20">{formatDateTime(comment.createdAt)}</span>
            </div>
            <p className="text-[11px] text-white/80">{comment.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommunityTab;
