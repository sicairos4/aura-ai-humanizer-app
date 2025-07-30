'use client';
import { ThemeSwitcher } from './ThemeSwitcher';

export function Header() {
  return (
    <header className="relative w-full py-6">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <ThemeSwitcher />
      </div>
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-6xl">
          Aura AI
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 sm:mt-4">
          Infuse Your Words with a Human Soul.
        </p>
      </div>
    </header>
  );
}