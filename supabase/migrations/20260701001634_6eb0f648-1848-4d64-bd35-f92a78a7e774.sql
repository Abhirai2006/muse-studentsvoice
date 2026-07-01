UPDATE public.allowed_usns SET department = CASE substring(usn from 5 for 2)
  WHEN 'AI' THEN 'AIML'
  WHEN 'AD' THEN 'AIDS'
  WHEN 'CD' THEN 'CSD'
  WHEN 'BR' THEN 'BMRE'
  WHEN 'CV' THEN 'CIVIL'
END
WHERE department IS NULL;