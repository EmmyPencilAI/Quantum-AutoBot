import React, { useState } from "react";
import { User, Bell, Shield, Wallet, LogOut, Check, ChevronRight, Camera, Globe, Smartphone } from "lucide-react";
import { auth, db } from "../firebase";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

interface SettingsTabProps {
  user: any;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ user }) => {
  const [username, setUsername] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [showAvatarGrid, setShowAvatarGrid] = useState(false);

  const avatars = Array.from({ length: 20 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=avatar${i}`);

  const handleUpdateProfile = async () => {
    if (!username.trim() || !user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: username });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { username });
      alert("Profile updated successfully!");
    } catch (e) {
      console.error("Error updating profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async (avatarUrl: string) => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { photoURL: avatarUrl });
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatar: avatarUrl });
      setShowAvatarGrid(false);
      alert("Avatar updated successfully!");
    } catch (e) {
      console.error("Error updating avatar:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Account Settings</h2>

      {/* Profile Section */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
          <div className="relative group cursor-pointer" onClick={() => setShowAvatarGrid(true)}>
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
              alt="Avatar"
              className="w-32 h-32 rounded-full border-4 border-orange-500/20 bg-white/5 group-hover:opacity-50 transition-all"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <Camera size={32} className="text-white" />
            </div>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-widest">Display Name</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-all font-bold text-lg"
                />
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="bg-orange-500 text-black font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-all disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Avatar Grid */}
        {showAvatarGrid && (
          <div className="grid grid-cols-4 md:grid-cols-10 gap-4 p-6 bg-white/5 rounded-3xl border border-white/10 mb-10">
            {avatars.map((avatar, i) => (
              <button
                key={i}
                onClick={() => handleUpdateAvatar(avatar)}
                className="w-full aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-500 transition-all"
              >
                <img src={avatar} alt="Avatar Option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group cursor-pointer hover:border-white/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center">
                <Globe size={20} />
              </div>
              <div>
                <p className="font-bold">Region</p>
                <p className="text-xs text-white/40">Global (Auto-detected)</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-white/20 group-hover:text-white transition-all" />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group cursor-pointer hover:border-white/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="font-bold">Notifications</p>
                <p className="text-xs text-white/40">Push enabled</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-white/20 group-hover:text-white transition-all" />
          </div>
        </div>
      </div>

      {/* Security & Account */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Shield size={20} className="text-orange-500" />
          <span>Security & Account</span>
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/10 text-orange-400 rounded-xl flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <div>
                <p className="font-bold">zkLogin Status</p>
                <p className="text-xs text-white/40">Verified via Google</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-widest">
              <Check size={14} />
              <span>Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <p className="font-bold">Trading Alerts</p>
                <p className="text-xs text-white/40">High Volatility Warnings</p>
              </div>
            </div>
            <div className="w-12 h-6 bg-orange-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-black rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => auth.signOut()}
        className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-bold py-6 rounded-3xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-3"
      >
        <LogOut size={24} />
        <span>Logout from Quantum Finance</span>
      </button>
    </div>
  );
};

export default SettingsTab;
