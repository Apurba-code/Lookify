import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import logo from '../assets/logo.png';

export function Auth() {
  const [isLogin, setIsLogin] = useState(false); // Default to signup as in the first image
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
      } else {
        if (!username || !fullName) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, username, fullName);
        if (error) setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen h-[100dvh] w-full bg-white dark:bg-zinc-950 flex flex-col md:flex-row selection:bg-blue-100 overflow-hidden">
      {/* Left side - Brand Messaging */}
      <div className="w-full md:w-[45%] h-[40%] md:h-full bg-zinc-950 p-10 md:p-16 flex flex-col justify-between relative overflow-hidden shrink-0">
        {/* Abstract Decorative Shapes - Gradient Style */}
        <div className="absolute top-[30%] -left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] left-[20%] w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[15%] right-[-5%] w-32 h-32 bg-blue-400/20 rotate-45 pointer-events-none" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        <div className="absolute bottom-10 right-20 w-16 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="Lookify Logo" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-bold text-white tracking-tight font-heading">Lookify</span>
        </div>

        <div key={isLogin.toString()} className="relative z-10 max-w-md animate-in fade-in slide-in-from-left-4 duration-500">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white leading-[1.05] mb-8 font-heading tracking-tight">
            {isLogin ? (
              <>Join the premium <span className="text-blue-500">creative</span> community.</>
            ) : (
              "Discover the Art of Lookify"
            )}
          </h2>
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed font-medium">
            Connect with artists, designers and 3D visionaries from around the globe.
          </p>
        </div>

        <div className="relative z-10 mt-12 text-zinc-600 text-xs tracking-widest uppercase font-bold">
          © 2026 LOOKIFY CO. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex flex-col p-10 md:p-16 relative bg-white dark:bg-zinc-950 overflow-y-auto scrollbar-hide">

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto space-y-10">
          <div key={`header-${isLogin}`} className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <h3 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white font-heading">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h3>
            <p className="text-zinc-500 font-medium text-lg">
              {isLogin ? "Please enter your details to sign in." : "Enter your details to get started."}
            </p>
          </div>

          <form key={isLogin.toString()} onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isLogin && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Full name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Email</label>
              <input
                type="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50"
                required
              />
            </div>

            <div className="space-y-2 relative">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wider">Password</label>
                {isLogin && <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-all">Forgot password?</button>}
              </div>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-900 dark:text-white transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>


            {error && (
              <div className="text-red-500 text-sm py-3 px-4 bg-red-50 dark:bg-red-500/10 rounded-xl text-center font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-500/10"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-zinc-500 font-medium">
              {isLogin ? "New to Lookify? " : "Already have an account? "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-all"
              >
                {isLogin ? 'Create an account' : 'Log in'}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
