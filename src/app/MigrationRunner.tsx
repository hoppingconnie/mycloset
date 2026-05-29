'use client';
import { useEffect } from 'react';
import { migratePhotosToIndexedDB } from '@/lib/photoStore';

/** アプリ起動時に一度だけ、写真データを localStorage → IndexedDB へ移行する */
export default function MigrationRunner() {
  useEffect(() => {
    migratePhotosToIndexedDB().catch(console.warn);
  }, []);
  return null;
}
