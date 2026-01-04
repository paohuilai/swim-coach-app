import { SignIn } from "@clerk/clerk-react";
import { useEffect } from "react";

export default function SignInPage() {
  useEffect(() => {
    document.title = "金海豚游泳俱乐部 - 教练登录";
  }, []);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8 flex flex-col items-center">
        <img src="/logo.jpg" alt="金海豚游泳俱乐部" className="h-20 w-auto mb-4 object-contain" />
        <h1 className="text-3xl font-bold text-dolphin-blue mb-2">金海豚游泳俱乐部</h1>
        <h2 className="text-xl font-medium text-blue-700">教练登录</h2>
        <p className="text-blue-600 mt-2">专业的游泳教练助手</p>
      </div>
      <SignIn 
        path="/sign-in" 
        routing="path" 
        signUpUrl="/sign-up" 
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
