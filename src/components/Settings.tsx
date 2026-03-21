import React, { useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { User, Camera, Bell, Shield, LogOut } from "lucide-react";
import { motion } from "motion/react";

interface SettingsProps {
  userProfile: any;
}

export function Settings({ userProfile }: SettingsProps) {
  const [username, setUsername] = useState(userProfile?.username || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!username.trim() || !userProfile) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, "users", userProfile.uid);
      await updateDoc(userRef, {
        username: username
      });
      alert("Profile updated!");
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setIsUpdating(false);
    }
  };

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
          <button className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-2 rounded-xl shadow-lg hover:bg-emerald-400 transition-all">
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
            onClick={handleUpdate}
            disabled={isUpdating || username === userProfile?.username}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-white/90 disabled:opacity-50 transition-all"
          >
            Save Changes
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest px-2">Preferences</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl divide-y divide-white/5">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Bell className="text-blue-500" size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">Push Notifications</p>
                  <p className="text-xs text-white/40">Get alerts for trade profits</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="text-purple-500" size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">Privacy Mode</p>
                  <p className="text-xs text-white/40">Hide my address on leaderboard</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-white/10 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </div>

        <button className="w-full bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all border border-red-500/20">
          <LogOut size={18} />
          Disconnect Wallet
        </button>
      </div>
    </div>
  );
}
