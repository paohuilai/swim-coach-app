import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 text-center border border-gray-200">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">系统临时波动，请重试</h2>
            <p className="text-gray-500 mb-6 text-sm">
              检测到异常错误，您的操作数据（如草稿）已自动保护。请点击下方按钮重新加载。
            </p>
            {/* Developer details */}
            {process.env.NODE_ENV === 'development' && (
                <div className="bg-red-50 p-3 rounded text-left text-xs text-red-800 font-mono mb-6 overflow-auto max-h-32">
                    {this.state.error?.message}
                </div>
            )}
            <div className="flex flex-col gap-3">
                <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                重新加载页面
                </button>
                <button
                onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                }}
                className="w-full bg-white text-gray-600 border border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                清空缓存并重试
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
