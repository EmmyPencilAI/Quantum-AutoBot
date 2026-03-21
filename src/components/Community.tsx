import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { MessageSquare, Heart, Send, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatDistanceToNow } from "date-fns";

interface CommunityProps {
  userProfile: any;
}

export function Community({ userProfile }: CommunityProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handlePost = async () => {
    if (!newPost.trim() || !userProfile) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, "posts"), {
        authorUid: userProfile.uid,
        authorName: userProfile.username,
        authorAvatar: userProfile.avatar,
        content: newPost,
        likes: 0,
        createdAt: new Date().toISOString()
      });
      setNewPost("");
    } catch (error) {
      console.error("Failed to post:", error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error("Failed to like:", error);
    }
  };

  return (
    <div className="space-y-6 py-4 pb-32">
      {/* Post Box */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4">
        <textarea 
          placeholder="Share your trading insights..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none h-24 placeholder:text-white/20"
        />
        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-2">
            <img src={userProfile?.avatar} className="w-6 h-6 rounded-lg opacity-50" referrerPolicy="no-referrer" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{userProfile?.username}</span>
          </div>
          <button 
            onClick={handlePost}
            disabled={isPosting || !newPost.trim()}
            className="bg-emerald-500 text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition-all"
          >
            <Send size={16} />
            Post
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        <AnimatePresence>
          {posts.map((post) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={post.id}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={post.authorAvatar} className="w-10 h-10 rounded-xl bg-white/5" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-bold text-sm">{post.authorName}</p>
                    <p className="text-[10px] text-white/40 font-medium">
                      {post.createdAt ? formatDistanceToNow(new Date(post.createdAt)) + " ago" : "Just now"}
                    </p>
                  </div>
                </div>
                <button className="text-white/20 hover:text-white/60 transition-all">
                  <Share2 size={18} />
                </button>
              </div>
              
              <p className="text-sm leading-relaxed text-white/80">
                {post.content}
              </p>

              <div className="flex items-center gap-6 pt-2">
                <button 
                  onClick={() => handleLike(post.id)}
                  className="flex items-center gap-2 text-white/40 hover:text-red-500 transition-all group"
                >
                  <Heart size={18} className="group-active:scale-125 transition-transform" />
                  <span className="text-xs font-bold">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2 text-white/40 hover:text-blue-500 transition-all">
                  <MessageSquare size={18} />
                  <span className="text-xs font-bold">Reply</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
