import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-blue-600 mb-2">泳训追踪</h1>
        <p className="text-gray-600 mb-8">专业的游泳教练助手</p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            to="/sign-in"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm transition-colors"
          >
            登录
          </Link>
          <Link 
            to="/sign-up"
            className="px-6 py-2 bg-white text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 font-medium shadow-sm transition-colors"
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  );
}
