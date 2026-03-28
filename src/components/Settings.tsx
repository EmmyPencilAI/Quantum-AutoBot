import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Camera, Bell, Shield, LogOut, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsProps {
  userProfile: any;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}

const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'bottts', 'pixel-art', 'micah', 'miniavs', 
  'notionists', 'open-peeps', 'personas', 'shapes', 'lorelei', 'big-smile'
];

export function Settings({ userProfile, showConfirm, notify }: SettingsProps) {
  console.log("Settings Render:", { hasProfile: !!userProfile, username: userProfile?.username });
  const [username, setUsername] = useState(userProfile?.username || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [notifications, setNotifications] = useState(userProfile?.notifications ?? true);
  const [privacyMode, setPrivacyMode] = useState(userProfile?.privacyMode ?? false);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || "");
      setNotifications(userProfile.notifications ?? true);
      setPrivacyMode(userProfile.privacyMode ?? false);
    }
  }, [userProfile]);

  const handleUpdate = async (updates: any) => {
    if (!userProfile) {
      notify("Please connect your wallet to update settings", "error");
      return;
    }
    setIsUpdating(true);
    try {
      const profileRef = doc(db, "users", userProfile.uid);
      await updateDoc(profileRef, {
        ...updates,
        lastActive: new Date().toISOString()
      });
      notify("Profile updated!", "success");
    } catch (error) {
      console.error("Failed to update profile:", error);
      notify("Update failed", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUsernameSave = () => {
    if (!username.trim() || username === userProfile?.username) return;
    handleUpdate({ username });
  };

  const selectAvatar = (url: string) => {
    handleUpdate({ avatar: url });
    setShowAvatarPicker(false);
  };

  const toggleNotifications = () => {
    const newVal = !notifications;
    setNotifications(newVal);
    handleUpdate({ notifications: newVal });
  };

  const togglePrivacy = () => {
    const newVal = !privacyMode;
    setPrivacyMode(newVal);
    handleUpdate({ privacyMode: newVal });
  };

  const handleDisconnect = () => {
    showConfirm("Disconnect Wallet", "Are you sure you want to disconnect? This will reload the application.", () => {
      try {
        // Safer reload for iframe environments
        window.location.href = window.location.pathname + window.location.search;
      } catch (e) {
        console.error("Failed to reload:", e);
      }
    });
  };

  const avatars = AVATAR_STYLES.flatMap(style => 
    Array.from({ length: 5 }, (_, i) => `https://api.dicebear.com/7.x/${style}/svg?seed=${style}_${i}`)
  ).slice(0, 60);

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center py-8">
        <div className="relative group">
          <img 
            src={userProfile?.avatar} 
            alt="Avatar" 
            className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-white/10 p-1"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={() => setShowAvatarPicker(true)}
            className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-2 rounded-xl shadow-lg hover:bg-emerald-400 transition-all"
          >
            <Camera size={16} />
          </button>
        </div>
        <h2 className="mt-4 text-xl font-bold">{userProfile?.username}</h2>
        <p className="text-xs text-white/40 font-mono mt-1">{userProfile?.uid}</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Username</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <button 
            onClick={handleUsernameSave}
            disabled={isUpdating || username === userProfile?.username}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-white/90 disabled:opacity-50 transition-all"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest px-2">Preferences</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl divide-y divide-white/5">
            <button 
              onClick={toggleNotifications}
              className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Bell className="text-blue-500" size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">Push Notifications</p>
                  <p className="text-xs text-white/40">Get alerts for trade profits</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors ${notifications ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notifications ? 'right-1' : 'left-1'}`} />
              </div>
            </button>
            
            <button 
              onClick={togglePrivacy}
              className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="text-purple-500" size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">Privacy Mode</p>
                  <p className="text-xs text-white/40">Hide my address on leaderboard</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors ${privacyMode ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${privacyMode ? 'right-1' : 'left-1'}`} />
              </div>
            </button>
          </div>
        </div>

        <button 
          onClick={handleDisconnect}
          className="w-full bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all border border-red-500/20"
        >
          <LogOut size={18} />
          Disconnect Wallet
        </button>
      </div>

      <AnimatePresence>
        {showAvatarPicker && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAvatarPicker(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-bold">Choose Avatar</h3>
                <button onClick={() => setShowAvatarPicker(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-4">
                {avatars.map((url, index) => {
                  const isSelected = userProfile?.avatar === url;
                  return (
                    <button 
                      key={index}
                      onClick={() => selectAvatar(url)}
                      className={`relative aspect-square rounded-2xl bg-white/5 border-2 transition-all hover:scale-105 ${isSelected ? 'border-emerald-500' : 'border-transparent hover:border-white/20'}`}
                    >
                      <img src={url} alt={`Avatar ${index}`} className="w-full h-full p-2" referrerPolicy="no-referrer" />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-black p-1 rounded-full shadow-lg">
                          <Check size={10} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
