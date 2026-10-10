// Copyright 2025 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package repo

import (
	"strings"

	user_model "gitea.dev/models/user"
	"gitea.dev/modules/log"
	"gitea.dev/modules/setting"
	"gitea.dev/modules/util"
	"gitea.dev/services/context"
	files_service "gitea.dev/services/repository/files"
)

func WebGitOperationCommonData(ctx *context.Context) {
	// TODO: more places like "wiki page" and "merging a pull request or creating an auto merge merging task"
	emails, err := user_model.GetActivatedEmailAddresses(ctx, ctx.Doer.ID)
	if err != nil {
		log.Error("WebGitOperationCommonData: GetActivatedEmailAddresses: %v", err)
	}
	if ctx.Doer.KeepEmailPrivate {
		emails = append([]string{ctx.Doer.GetPlaceholderEmail()}, emails...)
	}
	ctx.Data["CommitCandidateEmails"] = emails
	ctx.Data["CommitDefaultEmail"] = ctx.Doer.GetEmail()
	ctx.Data["CommitDefaultName"] = ctx.Doer.GitName()
}

func WebGitOperationGetCommitChosenEmailIdentity(ctx *context.Context, name, email string) (_ *files_service.IdentityOptions, valid bool) {
	if ctx.Data["CommitCandidateEmails"] == nil {
		setting.PanicInDevOrTesting("no CommitCandidateEmails in context data")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = ctx.Doer.GitName()
	} else if strings.ContainsAny(name, "\r\n<>") {
		return nil, false
	}
	email = strings.TrimSpace(email)
	if email == "" {
		email = ctx.Doer.GetEmail()
	} else {
		emails, _ := ctx.Data["CommitCandidateEmails"].([]string)
		if !util.SliceContainsString(emails, email, true) {
			return nil, false
		}
	}
	return &files_service.IdentityOptions{GitUserName: name, GitUserEmail: email}, true
}
