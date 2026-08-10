/**
 * 老师详情旧入口
 *
 * 教师管理已重构为「老师详情表单页」，此处仅做兼容重定向。
 */
import Taro, { useRouter } from '@tarojs/taro';
import React, { useEffect } from 'react';
import Loading from '@/components/Loading';

const TeacherDetailRedirectPage: React.FC = () => {
  const { id } = useRouter().params;

  useEffect(() => {
    const url = id
      ? `/package-teacher/pages/teacher-form/index?id=${id}`
      : '/package-teacher/pages/teacher-form/index';
    Taro.redirectTo({ url });
  }, [id]);

  return <Loading text="页面跳转中..." />;
};

export default TeacherDetailRedirectPage;
