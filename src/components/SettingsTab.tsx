import React, { useState } from "react";
import { User, Bell, Shield, Wallet, LogOut, Check, ChevronRight, Camera, Globe, Smartphone, RefreshCw } from "lucide-react";
import { auth, db } from "../firebase";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";

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
      toast.success("Profile updated successfully!");
    } catch (e: any) {
      console.error("Error updating profile:", e);
      toast.error("Profile update failed: " + (e.message || "Unknown error"));
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
      toast.success("Avatar updated!");
    } catch (e: any) {
      console.error("Error updating avatar:", e);
      toast.error("Avatar update failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkSystemStatus = async () => {
    setCheckingStatus(true);
    try {
      // Requires admin token — uses apiFetch for Authorization header
      const data = await apiFetch("/api/admin/status");
      setSystemStatus(data);
    } catch (e: any) {
      console.error("Error checking system status:", e);
      toast.error("Status check failed: " + (e.message || "Admin access required"));
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 md:pb-0">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Account Settings</h2>

      {/* Profile Section */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 mb-8 md:mb-10">
          <div className="relative group cursor-pointer" onClick={() => setShowAvatarGrid(true)}>
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
              alt="Avatar"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-orange-500/20 bg-white/5 group-hover:opacity-50 transition-all"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <Camera size={24} className="text-white md:w-8 md:h-8" />
            </div>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-[10px] md:text-xs font-bold text-white/40 uppercase mb-2 block tracking-widest">Display Name</label>
              <div className="flex gap-2 md:gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 focus:outline-none focus:border-orange-500 transition-all font-bold text-base md:text-lg"
                />
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="bg-orange-500 text-black font-bold px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl hover:scale-105 transition-all disabled:opacity-50 text-sm md:text-base"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Avatar Grid */}
        {showAvatarGrid && (
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2 md:gap-4 p-4 md:p-6 bg-white/5 rounded-2xl md:rounded-3xl border border-white/10 mb-8 md:mb-10">
            {avatars.map((avatar, i) => (
              <button
                key={i}
                onClick={() => handleUpdateAvatar(avatar)}
                className="w-full aspect-square rounded-lg md:rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-500 transition-all"
              >
                <img src={avatar} alt="Avatar Option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 flex items-center justify-between group cursor-pointer hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/10 text-blue-400 rounded-lg md:rounded-xl flex items-center justify-center">
                <Globe size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">Region</p>
                <p className="text-[10px] md:text-xs text-white/40">Global (Auto-detected)</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-all md:w-5 md:h-5" />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 flex items-center justify-between group cursor-pointer hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500/10 text-green-400 rounded-lg md:rounded-xl flex items-center justify-center">
                <Smartphone size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">Notifications</p>
                <p className="text-[10px] md:text-xs text-white/40">Push enabled</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-all md:w-5 md:h-5" />
          </div>
        </div>
      </div>

      {/* System Status Section */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Shield size={20} className="text-orange-500" />
            <span>System Status</span>
          </h3>
          <button 
            onClick={checkSystemStatus}
            disabled={checkingStatus}
            className="text-xs font-bold text-orange-500 hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} className={checkingStatus ? "animate-spin" : ""} />
            {checkingStatus ? "Checking..." : "Check Status"}
          </button>
        </div>
        
        <div className="space-y-4">
          {systemStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Backend Connection</p>
                <p className={`font-bold ${systemStatus.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                  {systemStatus.status === "ok" ? "Connected" : "Disconnected"}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Firestore Database</p>
                <p className="font-bold text-sm truncate">{systemStatus.databaseId || "Default"}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Last Health Check</p>
                <p className="font-bold text-xs">{systemStatus.lastPing ? new Date(systemStatus.lastPing).toLocaleString() : "N/A"}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Project ID</p>
                <p className="font-bold text-xs truncate">{systemStatus.projectId || "N/A"}</p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
              <p className="text-white/40 text-sm">Click "Check Status" to verify backend connectivity.</p>
            </div>
          )}
        </div>
      </div>

      {/* Security & Account */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl">
        <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-2">
          <Shield size={20} className="text-orange-500" />
          <span>Security & Account</span>
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 md:p-6 bg-white/5 rounded-xl md:rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500/10 text-orange-400 rounded-lg md:rounded-xl flex items-center justify-center">
                <Wallet size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">Authentication</p>
                <p className="text-[10px] md:text-xs text-white/40">Firebase Auth via {user?.providerData?.[0]?.providerId || "OAuth"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">
              <Check size={12} className="md:w-[14px] md:h-[14px]" />
              <span>Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 md:p-6 bg-white/5 rounded-xl md:rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 text-red-400 rounded-lg md:rounded-xl flex items-center justify-center">
                <Bell size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">Trading Alerts</p>
                <p className="text-[10px] md:text-xs text-white/40">High Volatility Warnings</p>
              </div>
            </div>
            <div className="w-10 h-5 md:w-12 md:h-6 bg-orange-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-3 h-3 md:w-4 md:h-4 bg-black rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => auth.signOut()}
        className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-bold py-4 md:py-6 rounded-2xl md:rounded-3xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
      >
        <LogOut size={20} className="md:w-6 md:h-6" />
        <span>Logout from Quantum Finance</span>
      </button>
    </div>
  );
};

export default SettingsTab;
