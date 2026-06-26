import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: '주식 스타터',
    description: '초보 투자자를 위한 쉬운 주식 추천 서비스',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
