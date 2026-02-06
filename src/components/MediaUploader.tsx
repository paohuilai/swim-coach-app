import { useState, useRef } from 'react';
import { Upload, X, Film, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface MediaUploaderProps {
    files: string[];
    onFilesChange: (files: string[]) => void;
    maxFiles?: number;
}

export default function MediaUploader({ files, onFilesChange, maxFiles = 3 }: MediaUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        if (files.length + fileList.length > maxFiles) {
            alert(`最多只能上传 ${maxFiles} 个文件`);
            return;
        }

        setUploading(true);
        const newUrls: string[] = [];

        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                // Simple validation
                if (file.size > 50 * 1024 * 1024) { // 50MB
                    alert(`文件 ${file.name} 过大 (超过50MB)`);
                    continue;
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `templates/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('templates') // Bucket name
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('templates')
                    .getPublicUrl(filePath);

                newUrls.push(publicUrl);
            }

            onFilesChange([...files, ...newUrls]);
        } catch (error: any) {
            console.error('Upload error:', error);
            alert('上传失败: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        onFilesChange(newFiles);
    };

    const isVideo = (url: string) => {
        return url.match(/\.(mp4|mov|webm)$/i);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
                {files.map((url, index) => (
                    <div key={url} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                        {isVideo(url) ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <Film className="w-8 h-8" />
                            </div>
                        ) : (
                            <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                        )}
                        <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {files.length < maxFiles && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-500",
                            uploading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {uploading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <>
                                <Upload className="w-6 h-6 mb-1" />
                                <span className="text-[10px]">上传</span>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept="image/*,video/*" 
                className="hidden" 
                onChange={handleUpload}
                disabled={uploading}
            />
            <p className="text-xs text-gray-400">支持图片和视频，单个不超过50MB</p>
        </div>
    );
}
