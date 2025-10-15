// 布局模板配置
const LAYOUT_TEMPLATES = {
    "default": {
        name: "預設佈局（六區塊）",
        html: "default.html",
        description: "經典六區塊佈局：頁首影片 + 四個輪播區 + 頁尾內容",
        sections: {
            "header_video": "頁首影片區",
            "top_left": "左上輪播區",
            "top_right": "右上輪播區",
            "bottom_left": "左下輪播區",
            "bottom_right": "右下輪播區",
            "footer_content": "頁尾內容區"
        }
    },
    "dual_video": {
        name: "雙影片佈局",
        html: "dual_video.html",
        description: "雙影片佈局：兩個頁首影片 + 底部左右輪播 + 頁尾內容",
        sections: {
            "header_video": "頁首影片區",
            "header_1_video": "第二頁首影片區",
            "bottom_left": "左下輪播區",
            "bottom_right": "右下輪播區",
            "footer_content": "頁尾內容區"
        }
    }
};

// 導出給管理界面使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LAYOUT_TEMPLATES };
}
