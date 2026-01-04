import { SignUp } from "@clerk/clerk-react";
import { useEffect } from "react";

export default function SignUpPage() {
  useEffect(() => {
    document.title = "金海豚游泳俱乐部 - 教练注册";
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8 flex flex-col items-center">
        <img src="/logo.jpg" alt="金海豚游泳俱乐部" className="h-20 w-auto mb-4 object-contain" />
        <h1 className="text-3xl font-bold text-dolphin-blue mb-2">金海豚游泳俱乐部</h1>
        <h2 className="text-xl font-medium text-blue-700">创建教练账号</h2>
        <p className="text-blue-600 mt-2">开始您的专业执教之旅</p>
      </div>
      <SignUp 
        path="/sign-up" 
        routing="path" 
        signInUrl="/sign-in"
        appearance={{
          elements: {
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            formButtonPrimary: "bg-dolphin-blue hover:bg-blue-900",
            footerActionLink: "text-dolphin-blue hover:text-blue-900",
            card: "shadow-xl border border-blue-100"
          }
        }}
      />
    </div>
  );
}
