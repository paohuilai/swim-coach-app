import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";

type FormValues = {
  date: string;
  distance_km: number;
  status_score: number | null;
  status_note: string;
  performances: {
    stroke: string;
    time_seconds: number;
  }[];
};

export default function TrainingEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      distance_km: 0,
      status_score: null,
      status_note: "",
      performances: [{ stroke: "100米自由泳", time_seconds: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "performances"
  });

  const onSubmit = async (data: FormValues) => {
    if (!id) return;
    setSubmitting(true);

    try {
      // 1. Create Training Log
      const { data: logData, error: logError } = await supabase
        .from("training_logs")
        .insert([
          {
            athlete_id: id,
            date: data.date,
            distance_km: data.distance_km,
            status_score: data.status_score ? Number(data.status_score) : null,
            status_note: data.status_note,
          },
        ])
        .select()
        .single();

      if (logError) throw logError;

      // 2. Create Performance Entries
      if (data.performances.length > 0) {
        // Filter out empty entries if needed, or assume validation handled it
        const entries = data.performances.map((p) => ({
          log_id: logData.id,
          stroke: p.stroke,
          time_seconds: p.time_seconds,
        }));

        const { error: perfError } = await supabase
          .from("performance_entries")
          .insert(entries);

        if (perfError) throw perfError;
      }

      navigate(`/athletes/${id}`);
    } catch (error: any) {
      alert("保存失败: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/athletes/${id}`} className="text-gray-500 hover:text-gray-900 flex items-center mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回运动员详情
      </Link>
      
      <h1 className="text-2xl font-bold mb-6">录入训练记录</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Date and Distance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              {...register("date", { required: true })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">训练量 (公里)</label>
            <input
              type="number"
              step="0.1"
              {...register("distance_km", { required: true, min: 0 })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Performances */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">成绩记录</h3>
            <button
              type="button"
              onClick={() => append({ stroke: "", time_seconds: 0 })}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加泳姿
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-4 items-end bg-gray-50 p-4 rounded-md">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">泳姿 (如: 100米自由泳)</label>
                  <input
                    {...register(`performances.${index}.stroke` as const, { required: true })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="项目名称"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">时间 (秒)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`performances.${index}.time_seconds` as const, { required: true, min: 0 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:text-red-700 p-2"
                  title="删除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Status Score (New Section) */}
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">状态评分 (可选)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-purple-50 p-4 rounded-md border border-purple-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当天状态 (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  {...register("status_score", { min: 0, max: 100 })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  {...register("status_note")}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="睡眠、身体状况等..."
                  rows={1}
                />
              </div>
            </div>
         </div>

        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-dolphin-gold text-dolphin-blue font-bold px-6 py-2 rounded-md hover:bg-yellow-400 disabled:opacity-50 shadow-sm"
          >
            {submitting ? "保存中..." : "保存记录"}
          </button>
        </div>
      </form>
    </div>
  );
}