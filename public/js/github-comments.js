// use of ajax vs getJSON for headers use to get markdown (body vs body_htmml)
// todo: new comment location, pages, configure issue url

function DoGithubComments(comment_id)
{
    var url = "https://github.com/dwilliamson/donw.io/issues/" + comment_id;
    var api_url = "https://api.github.com/repos/dwilliamson/donw.io/issues/" + comment_id + "/comments"

    $(document).ready(function () {
        $.ajax(api_url, {
            headers: {Accept: "application/vnd.github.v3.html+json"},
            dataType: "json",
            success: function(comments) {
                $("#gh-comments-list").append("Visit the <b><a href='" + url + "'>Github Issue</a></b> to comment on this post");
                $.each(comments, function(i, comment) {

                    var date = new Date(comment.created_at);

                    var t = "<div id='gh-comment'>";
                    t += "<img src='" + comment.user.avatar_url + "' width='24px'>";
                    t += "<b><a href='" + comment.user.html_url + "'>" + comment.user.login + "</a></b>";
                    t += " posted at ";
                    t += "<em>" + date.toUTCString() + "</em>";
                    t += "<div id='gh-comment-hr'></div>";
                    t += comment.body_html;
                    t += "</div>";
                    $("#gh-comments-list").append(t);
                });
            },
            error: function() {
                $("#gh-comments-list").append("Comments are not open for this post yet.");
            }
        });
    });
}