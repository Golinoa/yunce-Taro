import { useDidShow, useDidHide } from '@tarojs/taro';
import React from 'react';
import { AuthProvider } from '@/utils/auth';
import 'uno.css';
import './app.scss';

const App: React.FC<{ children?: React.ReactNode }> = (props) => {
  useDidShow(() => {
    // App 可见
  });

  useDidHide(() => {
    // App 隐藏
  });

  return <AuthProvider>{props.children}</AuthProvider>;
};

export default App;
