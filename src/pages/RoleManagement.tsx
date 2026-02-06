import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Coach, UserRole } from '../types';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { Save, Shield, MapPin } from 'lucide-react';

export default function RoleManagement() {
  const { isAdmin, loading: profileLoading } = useCoachProfile();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchCoaches();
    }
  }, [isAdmin]);

  async function fetchCoaches() {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoaches(data || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateCoach(id: string, updates: Partial<Coach>) {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('coaches')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setCoaches(coaches.map(c => c.id === id ? { ...c, ...updates } : c));
    } catch (error) {
      console.error('Error updating coach:', error);
      alert('更新失败');
    } finally {
      setSaving(null);
    }
  }

  if (profileLoading) return <div className="p-8">加载中...</div>;
  if (!isAdmin) return <div className="p-8 text-red-500">您没有权限访问此页面</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用户权限管理</h1>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属场馆</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">管理场馆</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">加载数据中...</td></tr>
              ) : coaches.map((coach) => (
                <tr key={coach.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {coach.last_name}{coach.first_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{coach.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={coach.role || 'coach'}
                      onChange={(e) => updateCoach(coach.id, { role: e.target.value as UserRole })}
                    >
                      <option value="coach">教练</option>
                      <option value="manager">馆长</option>
                      <option value="admin">总管</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="text"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="例如: 东山馆"
                      value={coach.venue || ''}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setCoaches(coaches.map(c => c.id === coach.id ? { ...c, venue: newVal } : c));
                      }}
                      onBlur={(e) => updateCoach(coach.id, { venue: e.target.value })}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {coach.role === 'manager' && (
                      <input
                        type="text"
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="管理哪个馆"
                        value={coach.managed_venue || ''}
                        onChange={(e) => {
                            const newVal = e.target.value;
                            setCoaches(coaches.map(c => c.id === coach.id ? { ...c, managed_venue: newVal } : c));
                        }}
                        onBlur={(e) => updateCoach(coach.id, { managed_venue: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {saving === coach.id && <span className="text-blue-600">保存中...</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
