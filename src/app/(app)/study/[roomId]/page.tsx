'use client';
import StudyRoom from "@/components/study/StudyRoom";

export default function StudyRoomPage({ params }: { params: { roomId: string } }) {
    const { roomId } = params;

    return (
        <div className="h-full">
            <StudyRoom roomId={roomId} />
        </div>
    );
}
