-- Team RSS blogs reuse the existing Member/BlogPost feed shape but stay out of member listings.
ALTER TABLE "Member" ADD COLUMN "isTeamBlog" BOOLEAN NOT NULL DEFAULT false;
