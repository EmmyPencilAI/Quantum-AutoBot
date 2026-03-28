import React, { useState, useEffect } from "react";
import { MessageSquare, Heart, Share2, Plus, Send, MoreHorizontal, UserPlus, TrendingUp, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";

interface CommunityTabProps {
  user: any;
}

const CommunityTab: React.FC<CommunityTabProps> = ({ user }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "posts");
    });
    return () => unsubscribe();
  }, []);

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
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    const path = `posts/${postId}`;
    try {
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        likesCount: increment(1),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Feed Section */}
      <div className="lg:col-span-2 space-y-6">
        {/* Create Post */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="flex gap-4 mb-4">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
              alt="Avatar"
              className="w-12 h-12 rounded-full bg-white/5"
              referrerPolicy="no-referrer"
            />
            <textarea
              placeholder="Share your trading insights..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-orange-500 transition-all resize-none h-24 text-sm"
            />
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex gap-2">
              <button className="text-white/40 hover:text-orange-500 transition-colors p-2 rounded-lg hover:bg-white/5">
                <TrendingUp size={20} />
              </button>
              <button className="text-white/40 hover:text-orange-500 transition-colors p-2 rounded-lg hover:bg-white/5">
                <Plus size={20} />
              </button>
            </div>
            <button
              onClick={handleCreatePost}
              disabled={loading || !newPost.trim()}
              className="bg-orange-500 text-black font-bold px-6 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
            >
              <Send size={18} />
              <span>Post</span>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-6">
          <AnimatePresence>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-12 h-12 rounded-full bg-white/5"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="font-bold text-lg hover:text-orange-500 cursor-pointer transition-colors">
                        {post.authorName}
                      </p>
                      <p className="text-xs text-white/40">
                        {new Date(post.createdAt).toLocaleDateString()} • Just now
                      </p>
                    </div>
                  </div>
                  <button className="text-white/20 hover:text-white transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                <div className="flex items-center gap-6 border-t border-white/5 pt-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 text-white/40 hover:text-red-400 transition-colors group/btn"
                  >
                    <Heart size={20} className="group-hover/btn:fill-red-400" />
                    <span className="text-sm font-bold">{post.likesCount || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-blue-400 transition-colors group/btn">
                    <MessageSquare size={20} className="group-hover/btn:fill-blue-400" />
                    <span className="text-sm font-bold">{post.commentsCount || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-green-400 transition-colors group/btn ml-auto">
                    <Share2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sidebar Section */}
      <div className="hidden lg:block space-y-8">
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

export default CommunityTab;
