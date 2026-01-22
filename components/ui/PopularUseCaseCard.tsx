import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PopularUseCaseCardProps {
    label: string;
    gradient: string;
    image?: string; // Optional image URL if we had them
    onClick: () => void;
}

export const PopularUseCaseCard: React.FC<PopularUseCaseCardProps> = ({ label, gradient, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`relative h-28 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-gray-100 ${gradient}`}
        >
            {/* Overlay for text readability */}
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />

            {/* Content */}
            <div className="absolute inset-0 p-4 flex flex-col justify-between">
                {/* Title */}
                <h3 className="text-white font-bold text-lg leading-tight w-3/4 drop-shadow-sm">
                    {label}
                </h3>

                {/* Action Arrow */}
                <div className="self-end opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors">
                        <ChevronRight className="w-5 h-5 text-white" />
                    </div>
                </div>
            </div>
        </div>
    );
};
