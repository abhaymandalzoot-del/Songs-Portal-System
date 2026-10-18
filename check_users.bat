@echo off
echo ========================================================
echo         SONGS PORTAL - REGISTERED USERS LIST
echo                 Database: SongsPortalSystem
echo ========================================================
"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE" -S localhost -d SongsPortalSystem -U sa -P Abhay@123 -Q "SET NOCOUNT ON; SELECT user_id, username, email, role, FORMAT(created_at, 'yyyy-MM-dd HH:mm') AS registered_date FROM dbo.Users;"
echo ========================================================
pause
