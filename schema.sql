-- Run this in the Supabase SQL Editor

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    branch TEXT,
    gender TEXT,
    bio TEXT,
    preferences JSONB DEFAULT '[]'::jsonb,
    "alreadyHasRoommate" BOOLEAN DEFAULT false,
    "existingRoommateName" TEXT,
    "lookingFor" INTEGER DEFAULT 2,
    "avatarUrl" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Roommate Requests Table
CREATE TABLE IF NOT EXISTS public.roommate_requests (
    id TEXT PRIMARY KEY,
    "fromId" UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    "toId" UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE("fromId", "toId")
);

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roommate_requests ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone."
    ON public.profiles FOR SELECT
    USING ( true );

CREATE POLICY "Users can insert their own profile."
    ON public.profiles FOR INSERT
    WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
    ON public.profiles FOR UPDATE
    USING ( auth.uid() = id );

-- Roommate Requests Policies
CREATE POLICY "Users can view requests involving them."
    ON public.roommate_requests FOR SELECT
    USING ( auth.uid() = "fromId" OR auth.uid() = "toId" );

CREATE POLICY "Users can create requests."
    ON public.roommate_requests FOR INSERT
    WITH CHECK ( auth.uid() = "fromId" );

CREATE POLICY "Users can update requests they receive."
    ON public.roommate_requests FOR UPDATE
    USING ( auth.uid() = "toId" );

