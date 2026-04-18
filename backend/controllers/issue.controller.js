const Issue = require("../models/Issue");

exports.getIssues = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, gstin, issueType } = req.query;
    const filter = { user: req.userId };

    if (status) filter.status = status;
    if (gstin) filter.gstin = gstin;
    if (issueType) filter.issueType = issueType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Issue.countDocuments(filter),
    ]);

    res.json({
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateIssueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = ["OPEN", "FOLLOWED_UP", "RESOLVED", "IGNORED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const issue = await Issue.findOne({ _id: id, user: req.userId });
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    issue.status = status;
    issue.timeline.push({
      action: `Status changed to ${status}`,
      status,
      date: new Date(),
      note: note || "",
    });

    if (status === "FOLLOWED_UP") {
      issue.followUpDate = new Date();
    }
    if (status === "RESOLVED") {
      issue.resolvedDate = new Date();
    }

    await issue.save();

    res.json({ message: "Issue updated", issue });
  } catch (error) {
    next(error);
  }
};

exports.getIssueSummary = async (req, res, next) => {
  try {
    const summary = await Issue.aggregate([
      { $match: { user: req.userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalItcAtRisk: { $sum: "$itcAtRisk" },
        },
      },
    ]);

    const result = {
      OPEN: { count: 0, itcAtRisk: 0 },
      FOLLOWED_UP: { count: 0, itcAtRisk: 0 },
      RESOLVED: { count: 0, itcAtRisk: 0 },
      IGNORED: { count: 0, itcAtRisk: 0 },
    };

    summary.forEach((s) => {
      result[s._id] = { count: s.count, itcAtRisk: s.totalItcAtRisk };
    });

    res.json({ summary: result });
  } catch (error) {
    next(error);
  }
};
